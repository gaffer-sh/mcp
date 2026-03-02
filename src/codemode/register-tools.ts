import type { FunctionRegistry } from './registry.js'
import type { FunctionEntry } from './types.js'

import {
  compareTestMetricsInputSchema,
  compareTestMetricsMetadata,
  executeCompareTestMetrics,
} from '../tools/compare-test-metrics.js'

import {
  executeFindUncoveredFailureAreas,
  findUncoveredFailureAreasInputSchema,
  findUncoveredFailureAreasMetadata,
} from '../tools/find-uncovered-failure-areas.js'

import {
  executeGetCoverageForFile,
  getCoverageForFileInputSchema,
  getCoverageForFileMetadata,
} from '../tools/get-coverage-for-file.js'

import {
  executeGetCoverageSummary,
  getCoverageSummaryInputSchema,
  getCoverageSummaryMetadata,
} from '../tools/get-coverage-summary.js'

import {
  executeGetFailureClusters,
  getFailureClustersInputSchema,
  getFailureClustersMetadata,
} from '../tools/get-failure-clusters.js'

import {
  executeGetFlakyTests,
  getFlakyTestsInputSchema,
  getFlakyTestsMetadata,
} from '../tools/get-flaky-tests.js'

import {
  executeGetProjectHealth,
  getProjectHealthInputSchema,
  getProjectHealthMetadata,
} from '../tools/get-project-health.js'

import {
  executeGetReportBrowserUrl,
  getReportBrowserUrlInputSchema,
  getReportBrowserUrlMetadata,
} from '../tools/get-report-browser-url.js'

import {
  executeGetReport,
  getReportInputSchema,
  getReportMetadata,
} from '../tools/get-report.js'

import {
  executeGetSlowestTests,
  getSlowestTestsInputSchema,
  getSlowestTestsMetadata,
} from '../tools/get-slowest-tests.js'

import {
  executeGetTestHistory,
  getTestHistoryInputSchema,
  getTestHistoryMetadata,
} from '../tools/get-test-history.js'

import {
  executeGetTestRunDetails,
  getTestRunDetailsInputSchema,
  getTestRunDetailsMetadata,
} from '../tools/get-test-run-details.js'

import {
  executeGetUntestedFiles,
  getUntestedFilesInputSchema,
  getUntestedFilesMetadata,
} from '../tools/get-untested-files.js'

import {
  executeGetUploadStatus,
  getUploadStatusInputSchema,
  getUploadStatusMetadata,
} from '../tools/get-upload-status.js'

import {
  executeListTestRuns,
  listTestRunsInputSchema,
  listTestRunsMetadata,
} from '../tools/list-test-runs.js'

import {
  executeSearchFailures,
  searchFailuresInputSchema,
  searchFailuresMetadata,
} from '../tools/search-failures.js'

type ToolRegistration = Omit<FunctionEntry, 'name' | 'description'> & {
  metadata: { name: string, description: string }
}

const TOOLS: ToolRegistration[] = [
  {
    metadata: getProjectHealthMetadata,
    inputSchema: getProjectHealthInputSchema,
    execute: executeGetProjectHealth,
    category: 'health',
    keywords: ['health', 'score', 'pass rate', 'trend', 'overview'],
  },
  {
    metadata: getTestHistoryMetadata,
    inputSchema: getTestHistoryInputSchema,
    execute: executeGetTestHistory,
    category: 'testing',
    keywords: ['history', 'pass', 'fail', 'stability', 'regression'],
  },
  {
    metadata: getFlakyTestsMetadata,
    inputSchema: getFlakyTestsInputSchema,
    execute: executeGetFlakyTests,
    category: 'testing',
    keywords: ['flaky', 'flip', 'inconsistent', 'non-deterministic'],
  },
  {
    metadata: listTestRunsMetadata,
    inputSchema: listTestRunsInputSchema,
    execute: executeListTestRuns,
    category: 'testing',
    keywords: ['runs', 'list', 'commit', 'branch', 'recent'],
  },
  {
    metadata: getReportMetadata,
    inputSchema: getReportInputSchema,
    execute: executeGetReport,
    category: 'reports',
    keywords: ['report', 'files', 'download', 'artifacts'],
  },
  {
    metadata: getSlowestTestsMetadata,
    inputSchema: getSlowestTestsInputSchema,
    execute: executeGetSlowestTests,
    category: 'testing',
    keywords: ['slow', 'performance', 'duration', 'p95', 'bottleneck'],
  },
  {
    metadata: getTestRunDetailsMetadata,
    inputSchema: getTestRunDetailsInputSchema,
    execute: executeGetTestRunDetails,
    category: 'testing',
    keywords: ['details', 'results', 'errors', 'stack traces', 'test cases'],
  },
  {
    metadata: getFailureClustersMetadata,
    inputSchema: getFailureClustersInputSchema,
    execute: executeGetFailureClusters,
    category: 'testing',
    keywords: ['failure', 'clusters', 'root cause', 'error grouping'],
  },
  {
    metadata: compareTestMetricsMetadata,
    inputSchema: compareTestMetricsInputSchema,
    execute: executeCompareTestMetrics,
    category: 'testing',
    keywords: ['compare', 'before', 'after', 'regression', 'delta'],
  },
  {
    metadata: getCoverageSummaryMetadata,
    inputSchema: getCoverageSummaryInputSchema,
    execute: executeGetCoverageSummary,
    category: 'coverage',
    keywords: ['coverage', 'summary', 'lines', 'branches', 'functions'],
  },
  {
    metadata: getCoverageForFileMetadata,
    inputSchema: getCoverageForFileInputSchema,
    execute: executeGetCoverageForFile,
    category: 'coverage',
    keywords: ['coverage', 'file', 'path', 'lines', 'branches'],
  },
  {
    metadata: findUncoveredFailureAreasMetadata,
    inputSchema: findUncoveredFailureAreasInputSchema,
    execute: executeFindUncoveredFailureAreas,
    category: 'coverage',
    keywords: ['risk', 'uncovered', 'failures', 'low coverage'],
  },
  {
    metadata: getUntestedFilesMetadata,
    inputSchema: getUntestedFilesInputSchema,
    execute: executeGetUntestedFiles,
    category: 'coverage',
    keywords: ['untested', 'zero coverage', 'missing tests'],
  },
  {
    metadata: getReportBrowserUrlMetadata,
    inputSchema: getReportBrowserUrlInputSchema,
    execute: executeGetReportBrowserUrl,
    category: 'reports',
    keywords: ['browser', 'url', 'view', 'report', 'signed'],
  },
  {
    metadata: getUploadStatusMetadata,
    inputSchema: getUploadStatusInputSchema,
    execute: executeGetUploadStatus,
    category: 'uploads',
    keywords: ['upload', 'status', 'processing', 'CI', 'ready'],
  },
  {
    metadata: searchFailuresMetadata,
    inputSchema: searchFailuresInputSchema,
    execute: executeSearchFailures,
    category: 'testing',
    keywords: ['search', 'failure', 'error message', 'grep', 'find'],
  },
]

/**
 * Register all tool functions in the codemode registry.
 */
export function registerAllTools(registry: FunctionRegistry): void {
  for (const tool of TOOLS) {
    registry.register({
      name: tool.metadata.name,
      description: tool.metadata.description,
      category: tool.category,
      keywords: tool.keywords,
      inputSchema: tool.inputSchema,
      execute: tool.execute,
    })
  }
}
