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
 * - gfr_ = Project Token (single project)
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
 * 2. Project Tokens (gfr_) - Single project access, auto-resolves projectId
 *
 * All methods use the unified /user/projects/:id/ route tree.
 * Project tokens auto-resolve their projectId via /project on first use.
 */
export class GafferApiClient {
  private apiKey: string
  private baseUrl: string
  public readonly tokenType: TokenType
  private resolvedProjectId: string | null = null

  constructor(config: GafferConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.tokenType = detectTokenType(config.apiKey)
  }

  /**
   * Create client from environment variables
   *
   * Supports:
   * - GAFFER_API_KEY (for user API Keys gaf_ or project tokens gfr_)
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
   * Resolve the project ID for the current token.
   * For project tokens, fetches from /project on first call and caches.
   * For user tokens, requires explicit projectId.
   */
  async resolveProjectId(projectId?: string): Promise<string> {
    if (projectId) {
      return projectId
    }

    if (this.isUserToken()) {
      throw new Error('projectId is required when using a user API Key')
    }

    // Project token: resolve from /project endpoint (cached)
    if (this.resolvedProjectId) {
      return this.resolvedProjectId
    }

    const response = await this.request<{ project: { id: string } }>('/project')
    this.resolvedProjectId = response.project.id
    return this.resolvedProjectId
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
   * List all projects the user has access to.
   * Requires user API Key (gaf_). Not available with project tokens.
   */
  async listProjects(options: {
    organizationId?: string
    limit?: number
    offset?: number
  } = {}): Promise<ProjectsResponse> {
    if (!this.isUserToken()) {
      throw new Error('list_projects is not available with project tokens (gfr_). Your token is already scoped to a single project — call tools directly without passing projectId.')
    }

    return this.request<ProjectsResponse>('/user/projects', {
      ...(options.organizationId && { organizationId: options.organizationId }),
      ...(options.limit && { limit: options.limit }),
      ...(options.offset && { offset: options.offset }),
    })
  }

  /**
   * Get project health analytics
   */
  async getProjectHealth(options: {
    projectId?: string
    days?: number
  } = {}): Promise<AnalyticsResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<AnalyticsResponse>(`/user/projects/${projectId}/health`, {
      days: options.days || 30,
    })
  }

  /**
   * Get test history for a specific test
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

    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<TestHistoryResponse>(`/user/projects/${projectId}/test-history`, {
      ...(testName && { testName }),
      ...(filePath && { filePath }),
      ...(options.limit && { limit: options.limit }),
    })
  }

  /**
   * Get flaky tests for the project
   */
  async getFlakyTests(options: {
    projectId?: string
    threshold?: number
    limit?: number
    days?: number
  } = {}): Promise<FlakyTestsResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<FlakyTestsResponse>(`/user/projects/${projectId}/flaky-tests`, {
      ...(options.threshold && { threshold: options.threshold }),
      ...(options.limit && { limit: options.limit }),
      ...(options.days && { days: options.days }),
    })
  }

  /**
   * List test runs for the project
   */
  async getTestRuns(options: {
    projectId?: string
    commitSha?: string
    branch?: string
    status?: 'passed' | 'failed'
    limit?: number
  } = {}): Promise<TestRunsResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<TestRunsResponse>(`/user/projects/${projectId}/test-runs`, {
      ...(options.commitSha && { commitSha: options.commitSha }),
      ...(options.branch && { branch: options.branch }),
      ...(options.status && { status: options.status }),
      ...(options.limit && { limit: options.limit }),
    })
  }

  /**
   * Get report files for a test run
   */
  async getReport(testRunId: string): Promise<ReportResponse> {
    if (!this.isUserToken()) {
      throw new Error('getReport requires a user API Key (gaf_). Project tokens (gfr_) cannot access reports via API.')
    }

    if (!testRunId) {
      throw new Error('testRunId is required')
    }

    return this.request<ReportResponse>(`/user/test-runs/${testRunId}/report`)
  }

  /**
   * Get slowest tests for a project
   */
  async getSlowestTests(options: {
    projectId?: string
    days?: number
    limit?: number
    framework?: string
    branch?: string
  }): Promise<SlowestTestsResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<SlowestTestsResponse>(`/user/projects/${projectId}/slowest-tests`, {
      ...(options.days && { days: options.days }),
      ...(options.limit && { limit: options.limit }),
      ...(options.framework && { framework: options.framework }),
      ...(options.branch && { branch: options.branch }),
    })
  }

  /**
   * Get parsed test results for a specific test run
   */
  async getTestRunDetails(options: {
    projectId?: string
    testRunId: string
    status?: 'passed' | 'failed' | 'skipped'
    limit?: number
    offset?: number
  }): Promise<TestRunDetailsResponse> {
    if (!options.testRunId) {
      throw new Error('testRunId is required')
    }

    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<TestRunDetailsResponse>(
      `/user/projects/${projectId}/test-runs/${options.testRunId}/details`,
      {
        ...(options.status && { status: options.status }),
        ...(options.limit && { limit: options.limit }),
        ...(options.offset && { offset: options.offset }),
      },
    )
  }

  /**
   * Compare test metrics between two commits or test runs
   */
  async compareTestMetrics(options: {
    projectId?: string
    testName: string
    beforeCommit?: string
    afterCommit?: string
    beforeRunId?: string
    afterRunId?: string
  }): Promise<CompareTestResponse> {
    if (!options.testName) {
      throw new Error('testName is required')
    }

    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<CompareTestResponse>(
      `/user/projects/${projectId}/compare-test`,
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
   */
  async getCoverageSummary(options: {
    projectId?: string
    days?: number
  }): Promise<CoverageSummaryResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<CoverageSummaryResponse>(
      `/user/projects/${projectId}/coverage-summary`,
      {
        ...(options.days && { days: options.days }),
      },
    )
  }

  /**
   * Get coverage files for a project with filtering
   */
  async getCoverageFiles(options: {
    projectId?: string
    filePath?: string
    minCoverage?: number
    maxCoverage?: number
    limit?: number
    offset?: number
    sortBy?: 'path' | 'coverage'
    sortOrder?: 'asc' | 'desc'
  }): Promise<CoverageFilesResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<CoverageFilesResponse>(
      `/user/projects/${projectId}/coverage/files`,
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
   */
  async getCoverageRiskAreas(options: {
    projectId?: string
    days?: number
    coverageThreshold?: number
  }): Promise<CoverageRiskAreasResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<CoverageRiskAreasResponse>(
      `/user/projects/${projectId}/coverage/risk-areas`,
      {
        ...(options.days && { days: options.days }),
        ...(options.coverageThreshold !== undefined && { coverageThreshold: options.coverageThreshold }),
      },
    )
  }

  /**
   * Get a browser-navigable URL for viewing a test report
   */
  async getReportBrowserUrl(options: {
    projectId?: string
    testRunId: string
    filename?: string
  }): Promise<BrowserUrlResponse> {
    if (!options.testRunId) {
      throw new Error('testRunId is required')
    }

    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<BrowserUrlResponse>(
      `/user/projects/${projectId}/reports/${options.testRunId}/browser-url`,
      {
        ...(options.filename && { filename: options.filename }),
      },
    )
  }

  /**
   * Get failure clusters for a test run
   */
  async getFailureClusters(options: {
    projectId?: string
    testRunId: string
  }): Promise<FailureClustersResponse> {
    if (!options.testRunId) {
      throw new Error('testRunId is required')
    }

    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<FailureClustersResponse>(
      `/user/projects/${projectId}/test-runs/${options.testRunId}/failure-clusters`,
    )
  }

  /**
   * List upload sessions for a project
   */
  async listUploadSessions(options: {
    projectId?: string
    commitSha?: string
    branch?: string
    limit?: number
    offset?: number
  }): Promise<UploadSessionsResponse> {
    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<UploadSessionsResponse>(
      `/user/projects/${projectId}/upload-sessions`,
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
   */
  async getUploadSessionDetail(options: {
    projectId?: string
    sessionId: string
  }): Promise<UploadSessionDetailResponse> {
    if (!options.sessionId) {
      throw new Error('sessionId is required')
    }

    const projectId = await this.resolveProjectId(options.projectId)
    return this.request<UploadSessionDetailResponse>(
      `/user/projects/${projectId}/upload-sessions/${options.sessionId}`,
    )
  }
}
