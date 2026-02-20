/**
 * Response types for Gaffer API v1 endpoints
 */

/**
 * Shared pagination structure used across paginated API responses
 */
export interface Pagination {
  limit: number
  offset: number
  total: number
  hasMore: boolean
}

export interface ProjectEntry {
  id: string
  name: string
  description?: string | null
  retentionDays?: number | null
  organization: {
    id: string
    name: string
    slug: string
  }
  createdAt: string
  updatedAt: string
}

export interface ProjectsResponse {
  projects: ProjectEntry[]
  pagination: Pagination
}

export interface AnalyticsResponse {
  analytics: {
    projectId: string
    projectName: string
    period: {
      days: number
      start: string
      end: string
    }
    healthScore: number
    passRate: number | null
    testRunCount: number
    totalTests: number
    flakyTestCount: number
    trend: 'up' | 'down' | 'stable'
    computedAt: string
  }
}

export interface TestHistoryEntry {
  testRunId: string
  createdAt: string
  branch?: string
  commitSha?: string
  test: {
    name: string
    status: 'passed' | 'failed' | 'skipped' | 'pending'
    durationMs: number
    filePath?: string
    message?: string
  }
}

export interface TestHistoryResponse {
  history: TestHistoryEntry[]
  summary: {
    totalRuns: number
    passedRuns: number
    failedRuns: number
    passRate: number | null
    searchedBy: 'testName' | 'filePath'
    searchValue: string
  }
}

export interface FlakyTest {
  name: string
  flipRate: number
  flipCount: number
  totalRuns: number
  lastSeen: string
  flakinessScore: number
}

export interface FlakyTestsResponse {
  flakyTests: FlakyTest[]
  summary: {
    threshold: number
    totalFlaky: number
    period: number
  }
}

export interface TestRunEntry {
  id: string
  uniqueId: string
  description?: string
  branch?: string
  commitSha?: string
  framework?: string
  tags?: Record<string, unknown>
  summary: {
    passed: number
    failed: number
    skipped: number
    total: number
    durationMs?: number
  }
  createdAt: string
}

export interface TestRunsResponse {
  testRuns: TestRunEntry[]
  pagination: Pagination
}

export interface ApiErrorResponse {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export interface ReportFile {
  filename: string
  size: number
  contentType: string
  downloadUrl: string
}

export interface ReportResponse {
  testRunId: string
  projectId: string
  projectName: string
  resultSchema?: string
  files: ReportFile[]
  /** How long the download URLs are valid in seconds (present when using presigned URLs) */
  urlExpiresInSeconds?: number
}

export interface SlowestTestEntry {
  name: string
  fullName: string
  filePath?: string
  framework?: string
  avgDurationMs: number
  p95DurationMs: number
  runCount: number
}

export interface SlowestTestsResponse {
  slowestTests: SlowestTestEntry[]
  summary: {
    projectId: string
    projectName: string
    period: number
    totalReturned: number
  }
}

export interface GafferConfig {
  apiKey: string
  baseUrl: string
}

export interface TestCaseDetail {
  name: string
  fullName: string
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number | null
  filePath: string | null
  error: string | null
  errorStack: string | null
}

export interface TestRunDetailsResponse {
  testRunId: string
  commitSha: string | null
  branch: string | null
  framework: string | null
  createdAt: string
  summary: {
    passed: number
    failed: number
    skipped: number
    total: number
  }
  tests: TestCaseDetail[]
  pagination: Pagination
}

export interface CompareTestMetric {
  testRunId: string
  commit: string | null
  branch: string | null
  status: 'passed' | 'failed' | 'skipped'
  durationMs: number | null
  createdAt: string
}

export interface CompareTestResponse {
  testName: string
  before: CompareTestMetric
  after: CompareTestMetric
  change: {
    durationMs: number | null
    percentChange: number | null
    statusChanged: boolean
  }
}

/**
 * Coverage summary response
 */
export interface CoverageSummaryResponse {
  hasCoverage: boolean
  current?: {
    lines: number
    branches: number
    functions: number
  }
  trend?: {
    direction: 'up' | 'down' | 'stable'
    change: number
  }
  totalReports: number
  latestReportDate?: string | null
  lowestCoverageFiles?: Array<{
    path: string
    coverage: number
  }>
  message?: string
}

/**
 * Coverage metric with counts and percentage
 */
export interface CoverageMetric {
  covered: number
  total: number
  percentage: number
}

/**
 * Coverage file entry
 */
export interface CoverageFileEntry {
  path: string
  lines: {
    covered: number
    total: number
    percentage: number
  }
  branches: {
    covered: number
    total: number
    percentage: number
  }
  functions: {
    covered: number
    total: number
    percentage: number
  }
}

/**
 * Coverage files response
 */
export interface CoverageFilesResponse {
  hasCoverage: boolean
  files: CoverageFileEntry[]
  pagination: Pagination
  overallCoverage?: number | null
  message?: string
}

/**
 * Risk area entry
 */
export interface RiskAreaEntry {
  filePath: string
  coverage: number
  failureCount: number
  riskScore: number
  testNames: string[]
}

/**
 * Coverage risk areas response
 */
export interface CoverageRiskAreasResponse {
  hasCoverage: boolean
  hasTestResults: boolean
  riskAreas: RiskAreaEntry[]
  message?: string
  analysisParams: {
    days: number
    coverageThreshold: number
  }
}

/**
 * Browser URL response
 */
export interface BrowserUrlResponse {
  url: string
  filename: string
  testRunId: string
  expiresAt: string
  expiresInSeconds: number
}

/**
 * Failed test entry within a failure cluster
 */
export interface FailedTestEntry {
  name: string
  fullName: string
  errorMessage: string
  filePath: string | null
}

/**
 * Failure cluster grouping similar errors
 */
export interface FailureClusterEntry {
  representativeError: string
  count: number
  tests: FailedTestEntry[]
  similarity: number
}

/**
 * Failure clusters response
 */
export interface FailureClustersResponse {
  clusters: FailureClusterEntry[]
  totalFailures: number
}

/**
 * Upload session summary entry
 */
export interface UploadSessionEntry {
  id: string
  projectId: string
  uniqueId: string
  tags: Record<string, string> | null
  commitSha: string | null
  branch: string | null
  processingStatus: 'pending' | 'processing' | 'completed' | 'error'
  pendingFileCount: number
  failedFileCount: number
  createdAt: string
  updatedAt: string
}

/**
 * Upload sessions list response
 */
export interface UploadSessionsResponse {
  sessions: UploadSessionEntry[]
  pagination: Pagination
}

/**
 * Linked test run summary within an upload session detail
 */
export interface LinkedTestRunSummary {
  id: string
  framework: string | null
  summary: {
    passed: number
    failed: number
    skipped: number
    total: number
  }
  createdAt: string
}

/**
 * Linked coverage report summary within an upload session detail
 */
export interface LinkedCoverageReportSummary {
  id: string
  format: string
  createdAt: string
}

/**
 * Upload session detail response with linked results
 */
export interface UploadSessionDetailResponse {
  session: UploadSessionEntry
  testRuns: LinkedTestRunSummary[]
  coverageReports: LinkedCoverageReportSummary[]
}
