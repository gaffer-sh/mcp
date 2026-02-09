import type {
  AnalyticsResponse,
  ApiErrorResponse,
  BrowserUrlResponse,
  CompareTestResponse,
  CoverageFilesResponse,
  CoverageRiskAreasResponse,
  CoverageSummaryResponse,
  FailureClustersResponse,
  FlakyTestsResponse,
  GafferConfig,
  ProjectsResponse,
  ReportResponse,
  SlowestTestsResponse,
  TestHistoryResponse,
  TestRunDetailsResponse,
  TestRunsResponse,
  UploadSessionDetailResponse,
  UploadSessionsResponse,
} from './types.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const pkg = require('../package.json') as { version: string }

// Request timeout in milliseconds (30 seconds)
const REQUEST_TIMEOUT_MS = 30000

// Retry configuration
const MAX_RETRIES = 3
const INITIAL_RETRY_DELAY_MS = 1000
const RETRYABLE_STATUS_CODES = [401, 429, 500, 502, 503, 504]

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Token type detection based on prefix
 */
export type TokenType = 'user' | 'project'

/**
 * Detect token type from prefix
 * - gaf_ = user API Key (read-only, cross-project)
 * - gfr_ = Project Upload Token (legacy, single project)
 */
export function detectTokenType(token: string): TokenType {
  if (token.startsWith('gaf_')) {
    return 'user'
  }
  return 'project'
}

/**
 * Gaffer API v1 client for MCP server
 *
 * Supports two authentication modes:
 * 1. User API Keys (gaf_) - Read-only access to all user's projects
 * 2. Project Upload Tokens (gfr_) - Legacy, single project access
 */
export class GafferApiClient {
  private apiKey: string
  private baseUrl: string
  public readonly tokenType: TokenType

  constructor(config: GafferConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.tokenType = detectTokenType(config.apiKey)
  }

  /**
   * Create client from environment variables
   *
   * Supports:
   * - GAFFER_API_KEY (for user API Keys gaf_)
   */
  static fromEnv(): GafferApiClient {
    const apiKey = process.env.GAFFER_API_KEY
    if (!apiKey) {
      throw new Error('GAFFER_API_KEY environment variable is required')
    }

    const baseUrl = process.env.GAFFER_API_URL || 'https://app.gaffer.sh'

    return new GafferApiClient({ apiKey, baseUrl })
  }

  /**
   * Check if using a user API Key (enables cross-project features)
   */
  isUserToken(): boolean {
    return this.tokenType === 'user'
  }

  /**
   * Make authenticated request to Gaffer API with retry logic
   */
  private async request<T>(
    endpoint: string,
    params?: Record<string, string | number>,
  ): Promise<T> {
    const url = new URL(`/api/v1${endpoint}`, this.baseUrl)

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Set up request timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'X-API-Key': this.apiKey,
            'Accept': 'application/json',
            'User-Agent': `gaffer-mcp/${pkg.version}`,
          },
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as ApiErrorResponse

          // Check if we should retry this status code
          if (RETRYABLE_STATUS_CODES.includes(response.status) && attempt < MAX_RETRIES) {
            // For 429 (rate limit), use Retry-After header if available
            let delayMs = INITIAL_RETRY_DELAY_MS * (2 ** attempt)
            if (response.status === 429) {
              const retryAfter = response.headers.get('Retry-After')
              if (retryAfter) {
                delayMs = Math.max(delayMs, Number.parseInt(retryAfter, 10) * 1000)
              }
            }
            lastError = new Error(errorData.error?.message || `API request failed: ${response.status}`)
            await sleep(delayMs)
            continue
          }

          const errorMessage = errorData.error?.message || `API request failed: ${response.status}`
          throw new Error(errorMessage)
        }

        return response.json() as Promise<T>
      }
      catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          lastError = new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`)
          if (attempt < MAX_RETRIES) {
            await sleep(INITIAL_RETRY_DELAY_MS * (2 ** attempt))
            continue
          }
          throw lastError
        }

        // For network errors, retry
        if (error instanceof TypeError && attempt < MAX_RETRIES) {
          lastError = error
          await sleep(INITIAL_RETRY_DELAY_MS * (2 ** attempt))
          continue
        }

        throw error
      }
      finally {
        clearTimeout(timeoutId)
      }
    }

    // Should not reach here, but just in case
    throw lastError || new Error('Request failed after retries')
  }

  /**
   * List all projects the user has access to
   * Requires user API Key (gaf_)
   *
   * @param options - Query options
   * @param options.organizationId - Filter by organization ID
   * @param options.limit - Maximum number of results
   * @param options.offset - Offset for pagination
   */
  async listProjects(options: {
    organizationId?: string
    limit?: number
    offset?: number
  } = {}): Promise<ProjectsResponse> {
    if (!this.isUserToken()) {
      throw new Error('listProjects requires a user API Key (gaf_). Upload Tokens (gfr_) can only access a single project.')
    }

    return this.request<ProjectsResponse>('/user/projects', {
      ...(options.organizationId && { organizationId: options.organizationId }),
      ...(options.limit && { limit: options.limit }),
      ...(options.offset && { offset: options.offset }),
    })
  }

  /**
   * Get project health analytics
   *
   * @param options - Query options
   * @param options.projectId - Required for user tokens, ignored for project tokens
   * @param options.days - Analysis period in days (default: 30)
   */
  async getProjectHealth(options: {
    projectId?: string
    days?: number
  } = {}): Promise<AnalyticsResponse> {
    if (this.isUserToken()) {
      if (!options.projectId) {
        throw new Error('projectId is required when using a user API Key')
      }
      return this.request<AnalyticsResponse>(`/user/projects/${options.projectId}/health`, {
        days: options.days || 30,
      })
    }

    // Legacy: project token uses /project/analytics
    return this.request<AnalyticsResponse>('/project/analytics', {
      days: options.days || 30,
    })
  }

  /**
   * Get test history for a specific test
   *
   * @param options - Query options
   * @param options.projectId - Required for user tokens, ignored for project tokens
   * @param options.testName - Test name to search for
   * @param options.filePath - File path to search for
   * @param options.limit - Maximum number of results
   */
  async getTestHistory(options: {
    projectId?: string
    testName?: string
    filePath?: string
    limit?: number
  }): Promise<TestHistoryResponse> {
    const testName = options.testName?.trim()
    const filePath = options.filePath?.trim()

    if (!testName && !filePath) {
      throw new Error('Either testName or filePath is required (and must not be empty)')
    }

    if (this.isUserToken()) {
      if (!options.projectId) {
        throw new Error('projectId is required when using a user API Key')
      }
      return this.request<TestHistoryResponse>(`/user/projects/${options.projectId}/test-history`, {
        ...(testName && { testName }),
        ...(filePath && { filePath }),
        ...(options.limit && { limit: options.limit }),
      })
    }

    // Legacy: project token uses /project/test-history
    return this.request<TestHistoryResponse>('/project/test-history', {
      ...(testName && { testName }),
      ...(filePath && { filePath }),
      ...(options.limit && { limit: options.limit }),
    })
  }

  /**
   * Get flaky tests for the project
   *
   * @param options - Query options
   * @param options.projectId - Required for user tokens, ignored for project tokens
   * @param options.threshold - Minimum flip rate to be considered flaky (0-1)
   * @param options.limit - Maximum number of results
   * @param options.days - Analysis period in days
   */
  async getFlakyTests(options: {
    projectId?: string
    threshold?: number
    limit?: number
    days?: number
  } = {}): Promise<FlakyTestsResponse> {
    if (this.isUserToken()) {
      if (!options.projectId) {
        throw new Error('projectId is required when using a user API Key')
      }
      return this.request<FlakyTestsResponse>(`/user/projects/${options.projectId}/flaky-tests`, {
        ...(options.threshold && { threshold: options.threshold }),
        ...(options.limit && { limit: options.limit }),
        ...(options.days && { days: options.days }),
      })
    }

    // Legacy: project token uses /project/flaky-tests
    return this.request<FlakyTestsResponse>('/project/flaky-tests', {
      ...(options.threshold && { threshold: options.threshold }),
      ...(options.limit && { limit: options.limit }),
      ...(options.days && { days: options.days }),
    })
  }

  /**
   * List test runs for the project
   *
   * @param options - Query options
   * @param options.projectId - Required for user tokens, ignored for project tokens
   * @param options.commitSha - Filter by commit SHA
   * @param options.branch - Filter by branch name
   * @param options.status - Filter by status ('passed' or 'failed')
   * @param options.limit - Maximum number of results
   */
  async getTestRuns(options: {
    projectId?: string
    commitSha?: string
    branch?: string
    status?: 'passed' | 'failed'
    limit?: number
  } = {}): Promise<TestRunsResponse> {
    if (this.isUserToken()) {
      if (!options.projectId) {
        throw new Error('projectId is required when using a user API Key')
      }
      return this.request<TestRunsResponse>(`/user/projects/${options.projectId}/test-runs`, {
        ...(options.commitSha && { commitSha: options.commitSha }),
        ...(options.branch && { branch: options.branch }),
        ...(options.status && { status: options.status }),
        ...(options.limit && { limit: options.limit }),
      })
    }

    // Legacy: project token uses /project/test-runs
    return this.request<TestRunsResponse>('/project/test-runs', {
      ...(options.commitSha && { commitSha: options.commitSha }),
      ...(options.branch && { branch: options.branch }),
      ...(options.status && { status: options.status }),
      ...(options.limit && { limit: options.limit }),
    })
  }

  /**
   * Get report files for a test run
   *
   * @param testRunId - The test run ID
   * @returns Report metadata with download URLs for each file
   */
  async getReport(testRunId: string): Promise<ReportResponse> {
    if (!this.isUserToken()) {
      throw new Error('getReport requires a user API Key (gaf_). Upload Tokens (gfr_) cannot access reports via API.')
    }

    if (!testRunId) {
      throw new Error('testRunId is required')
    }

    return this.request<ReportResponse>(`/user/test-runs/${testRunId}/report`)
  }

  /**
   * Get slowest tests for a project
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.days - Analysis period in days (default: 30)
   * @param options.limit - Maximum number of results (default: 20)
   * @param options.framework - Filter by test framework
   * @param options.branch - Filter by git branch name
   * @returns Slowest tests sorted by P95 duration
   */
  async getSlowestTests(options: {
    projectId: string
    days?: number
    limit?: number
    framework?: string
    branch?: string
  }): Promise<SlowestTestsResponse> {
    if (!this.isUserToken()) {
      throw new Error('getSlowestTests requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    return this.request<SlowestTestsResponse>(`/user/projects/${options.projectId}/slowest-tests`, {
      ...(options.days && { days: options.days }),
      ...(options.limit && { limit: options.limit }),
      ...(options.framework && { framework: options.framework }),
      ...(options.branch && { branch: options.branch }),
    })
  }

  /**
   * Get parsed test results for a specific test run
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.testRunId - The test run ID (required)
   * @param options.status - Filter by test status ('passed', 'failed', 'skipped')
   * @param options.limit - Maximum number of results (default: 100)
   * @param options.offset - Pagination offset (default: 0)
   * @returns Parsed test cases with pagination
   */
  async getTestRunDetails(options: {
    projectId: string
    testRunId: string
    status?: 'passed' | 'failed' | 'skipped'
    limit?: number
    offset?: number
  }): Promise<TestRunDetailsResponse> {
    if (!this.isUserToken()) {
      throw new Error('getTestRunDetails requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    if (!options.testRunId) {
      throw new Error('testRunId is required')
    }

    return this.request<TestRunDetailsResponse>(
      `/user/projects/${options.projectId}/test-runs/${options.testRunId}/details`,
      {
        ...(options.status && { status: options.status }),
        ...(options.limit && { limit: options.limit }),
        ...(options.offset && { offset: options.offset }),
      },
    )
  }

  /**
   * Compare test metrics between two commits or test runs
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.testName - The test name to compare (required)
   * @param options.beforeCommit - Commit SHA for before (use with afterCommit)
   * @param options.afterCommit - Commit SHA for after (use with beforeCommit)
   * @param options.beforeRunId - Test run ID for before (use with afterRunId)
   * @param options.afterRunId - Test run ID for after (use with beforeRunId)
   * @returns Comparison of test metrics
   */
  async compareTestMetrics(options: {
    projectId: string
    testName: string
    beforeCommit?: string
    afterCommit?: string
    beforeRunId?: string
    afterRunId?: string
  }): Promise<CompareTestResponse> {
    if (!this.isUserToken()) {
      throw new Error('compareTestMetrics requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    if (!options.testName) {
      throw new Error('testName is required')
    }

    return this.request<CompareTestResponse>(
      `/user/projects/${options.projectId}/compare-test`,
      {
        testName: options.testName,
        ...(options.beforeCommit && { beforeCommit: options.beforeCommit }),
        ...(options.afterCommit && { afterCommit: options.afterCommit }),
        ...(options.beforeRunId && { beforeRunId: options.beforeRunId }),
        ...(options.afterRunId && { afterRunId: options.afterRunId }),
      },
    )
  }

  /**
   * Get coverage summary for a project
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.days - Analysis period in days (default: 30)
   * @returns Coverage summary with trends and lowest coverage files
   */
  async getCoverageSummary(options: {
    projectId: string
    days?: number
  }): Promise<CoverageSummaryResponse> {
    if (!this.isUserToken()) {
      throw new Error('getCoverageSummary requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    return this.request<CoverageSummaryResponse>(
      `/user/projects/${options.projectId}/coverage-summary`,
      {
        ...(options.days && { days: options.days }),
      },
    )
  }

  /**
   * Get coverage files for a project with filtering
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.filePath - Filter to specific file path
   * @param options.minCoverage - Minimum coverage percentage
   * @param options.maxCoverage - Maximum coverage percentage
   * @param options.limit - Maximum number of results
   * @param options.offset - Pagination offset
   * @param options.sortBy - Sort by 'path' or 'coverage'
   * @param options.sortOrder - Sort order 'asc' or 'desc'
   * @returns List of files with coverage data
   */
  async getCoverageFiles(options: {
    projectId: string
    filePath?: string
    minCoverage?: number
    maxCoverage?: number
    limit?: number
    offset?: number
    sortBy?: 'path' | 'coverage'
    sortOrder?: 'asc' | 'desc'
  }): Promise<CoverageFilesResponse> {
    if (!this.isUserToken()) {
      throw new Error('getCoverageFiles requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    return this.request<CoverageFilesResponse>(
      `/user/projects/${options.projectId}/coverage/files`,
      {
        ...(options.filePath && { filePath: options.filePath }),
        ...(options.minCoverage !== undefined && { minCoverage: options.minCoverage }),
        ...(options.maxCoverage !== undefined && { maxCoverage: options.maxCoverage }),
        ...(options.limit && { limit: options.limit }),
        ...(options.offset && { offset: options.offset }),
        ...(options.sortBy && { sortBy: options.sortBy }),
        ...(options.sortOrder && { sortOrder: options.sortOrder }),
      },
    )
  }

  /**
   * Get risk areas (files with low coverage AND test failures)
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.days - Analysis period in days (default: 30)
   * @param options.coverageThreshold - Include files below this coverage (default: 80)
   * @returns List of risk areas sorted by risk score
   */
  async getCoverageRiskAreas(options: {
    projectId: string
    days?: number
    coverageThreshold?: number
  }): Promise<CoverageRiskAreasResponse> {
    if (!this.isUserToken()) {
      throw new Error('getCoverageRiskAreas requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    return this.request<CoverageRiskAreasResponse>(
      `/user/projects/${options.projectId}/coverage/risk-areas`,
      {
        ...(options.days && { days: options.days }),
        ...(options.coverageThreshold !== undefined && { coverageThreshold: options.coverageThreshold }),
      },
    )
  }

  /**
   * Get a browser-navigable URL for viewing a test report
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.testRunId - The test run ID (required)
   * @param options.filename - Specific file to open (default: index.html)
   * @returns URL with signed token for browser access
   */
  async getReportBrowserUrl(options: {
    projectId: string
    testRunId: string
    filename?: string
  }): Promise<BrowserUrlResponse> {
    if (!this.isUserToken()) {
      throw new Error('getReportBrowserUrl requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    if (!options.testRunId) {
      throw new Error('testRunId is required')
    }

    return this.request<BrowserUrlResponse>(
      `/user/projects/${options.projectId}/reports/${options.testRunId}/browser-url`,
      {
        ...(options.filename && { filename: options.filename }),
      },
    )
  }

  /**
   * Get failure clusters for a test run
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.testRunId - The test run ID (required)
   * @returns Failure clusters grouped by error similarity
   */
  async getFailureClusters(options: {
    projectId: string
    testRunId: string
  }): Promise<FailureClustersResponse> {
    if (!this.isUserToken()) {
      throw new Error('getFailureClusters requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    if (!options.testRunId) {
      throw new Error('testRunId is required')
    }

    return this.request<FailureClustersResponse>(
      `/user/projects/${options.projectId}/test-runs/${options.testRunId}/failure-clusters`,
    )
  }

  /**
   * List upload sessions for a project
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.commitSha - Filter by commit SHA
   * @param options.branch - Filter by branch name
   * @param options.limit - Maximum number of results (default: 10)
   * @param options.offset - Pagination offset (default: 0)
   * @returns Paginated list of upload sessions
   */
  async listUploadSessions(options: {
    projectId: string
    commitSha?: string
    branch?: string
    limit?: number
    offset?: number
  }): Promise<UploadSessionsResponse> {
    if (!this.isUserToken()) {
      throw new Error('listUploadSessions requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    return this.request<UploadSessionsResponse>(
      `/user/projects/${options.projectId}/upload-sessions`,
      {
        ...(options.commitSha && { commitSha: options.commitSha }),
        ...(options.branch && { branch: options.branch }),
        ...(options.limit && { limit: options.limit }),
        ...(options.offset && { offset: options.offset }),
      },
    )
  }

  /**
   * Get upload session detail with linked results
   *
   * @param options - Query options
   * @param options.projectId - The project ID (required)
   * @param options.sessionId - The upload session ID (required)
   * @returns Upload session details with linked test runs and coverage reports
   */
  async getUploadSessionDetail(options: {
    projectId: string
    sessionId: string
  }): Promise<UploadSessionDetailResponse> {
    if (!this.isUserToken()) {
      throw new Error('getUploadSessionDetail requires a user API Key (gaf_).')
    }

    if (!options.projectId) {
      throw new Error('projectId is required')
    }

    if (!options.sessionId) {
      throw new Error('sessionId is required')
    }

    return this.request<UploadSessionDetailResponse>(
      `/user/projects/${options.projectId}/upload-sessions/${options.sessionId}`,
    )
  }
}
