import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GafferApiClient } from './api-client.js'
import {
  compareTestMetricsInputSchema,
  compareTestMetricsMetadata,
  compareTestMetricsOutputSchema,
  executeCompareTestMetrics,
} from './tools/compare-test-metrics.js'
import {
  executeFindUncoveredFailureAreas,
  findUncoveredFailureAreasInputSchema,
  findUncoveredFailureAreasMetadata,
  findUncoveredFailureAreasOutputSchema,
} from './tools/find-uncovered-failure-areas.js'
import {
  executeGetCoverageForFile,
  getCoverageForFileInputSchema,
  getCoverageForFileMetadata,
  getCoverageForFileOutputSchema,
} from './tools/get-coverage-for-file.js'
import {
  executeGetCoverageSummary,
  getCoverageSummaryInputSchema,
  getCoverageSummaryMetadata,
  getCoverageSummaryOutputSchema,
} from './tools/get-coverage-summary.js'
import {
  executeGetFailureClusters,
  getFailureClustersInputSchema,
  getFailureClustersMetadata,
  getFailureClustersOutputSchema,
} from './tools/get-failure-clusters.js'
import {
  executeGetFlakyTests,
  getFlakyTestsInputSchema,
  getFlakyTestsMetadata,
  getFlakyTestsOutputSchema,
} from './tools/get-flaky-tests.js'
import {
  executeGetProjectHealth,
  getProjectHealthInputSchema,
  getProjectHealthMetadata,
  getProjectHealthOutputSchema,
} from './tools/get-project-health.js'
import {
  executeGetReportBrowserUrl,
  getReportBrowserUrlInputSchema,
  getReportBrowserUrlMetadata,
  getReportBrowserUrlOutputSchema,
} from './tools/get-report-browser-url.js'
import {
  executeGetReport,
  getReportInputSchema,
  getReportMetadata,
  getReportOutputSchema,
} from './tools/get-report.js'
import {
  executeGetSlowestTests,
  getSlowestTestsInputSchema,
  getSlowestTestsMetadata,
  getSlowestTestsOutputSchema,
} from './tools/get-slowest-tests.js'
import {
  executeGetTestHistory,
  getTestHistoryInputSchema,
  getTestHistoryMetadata,
  getTestHistoryOutputSchema,
} from './tools/get-test-history.js'
import {
  executeGetTestRunDetails,
  getTestRunDetailsInputSchema,
  getTestRunDetailsMetadata,
  getTestRunDetailsOutputSchema,
} from './tools/get-test-run-details.js'
import {
  executeGetUntestedFiles,
  getUntestedFilesInputSchema,
  getUntestedFilesMetadata,
  getUntestedFilesOutputSchema,
} from './tools/get-untested-files.js'
import {
  executeGetUploadStatus,
  getUploadStatusInputSchema,
  getUploadStatusMetadata,
  getUploadStatusOutputSchema,
} from './tools/get-upload-status.js'
import {
  executeListProjects,
  listProjectsInputSchema,
  listProjectsMetadata,
  listProjectsOutputSchema,
} from './tools/list-projects.js'
import {
  executeListTestRuns,
  listTestRunsInputSchema,
  listTestRunsMetadata,
  listTestRunsOutputSchema,
} from './tools/list-test-runs.js'

/**
 * Log error to stderr for observability
 * MCP uses stdout for communication, so stderr is safe for logging
 */
function logError(toolName: string, error: unknown): void {
  const timestamp = new Date().toISOString()
  const message = error instanceof Error ? error.message : 'Unknown error'
  const stack = error instanceof Error ? error.stack : undefined
  console.error(`[${timestamp}] [gaffer-mcp] ${toolName} failed: ${message}`)
  if (stack) {
    console.error(stack)
  }
}

/**
 * Handle tool error: log it and return MCP error response
 */
function handleToolError(toolName: string, error: unknown): { content: { type: 'text', text: string }[], isError: true } {
  logError(toolName, error)
  const message = error instanceof Error ? error.message : 'Unknown error'
  return {
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  }
}

/**
 * Tool definition for registration helper.
 * Schema types use `any` to accommodate the MCP SDK's complex Zod type requirements.
 */
interface ToolDefinition<TInput, TOutput> {
  metadata: { name: string, title: string, description: string }
  inputSchema: any
  outputSchema: any
  execute: (client: GafferApiClient, input: TInput) => Promise<TOutput>
}

/**
 * Register a tool with the MCP server using a consistent pattern.
 * Reduces boilerplate by handling error wrapping and response formatting.
 */
function registerTool<TInput, TOutput>(
  server: McpServer,
  client: GafferApiClient,
  tool: ToolDefinition<TInput, TOutput>,
): void {
  server.registerTool(
    tool.metadata.name,
    {
      title: tool.metadata.title,
      description: tool.metadata.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    },
    async (input: TInput) => {
      try {
        const output = await tool.execute(client, input)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
          structuredContent: output as unknown as Record<string, unknown>,
        }
      }
      catch (error) {
        return handleToolError(tool.metadata.name, error)
      }
    },
  )
}

/**
 * Gaffer MCP Server
 *
 * Provides AI assistants with access to test history and health metrics.
 *
 * Supports two authentication modes:
 * 1. User API Keys (gaf_) - Read-only access to all user's projects
 *    Set via GAFFER_API_KEY environment variable
 * 2. Project Upload Tokens (gfr_) - Legacy, single project access
 */
async function main() {
  // Validate API key is present
  const apiKey = process.env.GAFFER_API_KEY
  if (!apiKey) {
    console.error('Error: GAFFER_API_KEY environment variable is required')
    console.error('')
    console.error('Get your API Key from: https://app.gaffer.sh/account/api-keys')
    console.error('')
    console.error('Then configure Claude Code or Cursor with:')
    console.error(JSON.stringify({
      mcpServers: {
        gaffer: {
          command: 'npx',
          args: ['-y', '@gaffer-sh/mcp'],
          env: {
            GAFFER_API_KEY: 'gaf_your-api-key-here',
          },
        },
      },
    }, null, 2))
    process.exit(1)
  }

  // Create API client
  const client = GafferApiClient.fromEnv()

  // Create MCP server
  const server = new McpServer(
    {
      name: 'gaffer',
      version: '0.1.0',
    },
    {
      instructions: `Gaffer provides test analytics and coverage data for your projects.

## Authentication

${client.isUserToken()
    ? 'You have access to multiple projects. Use `list_projects` to find project IDs, then pass `projectId` to all tools.'
    : 'Your token is scoped to a single project. Do NOT call `list_projects`. Do NOT pass `projectId` — it is resolved automatically. Note: some tools (coverage, failure clusters, slowest tests, etc.) require a user API key and are not available.'}

## Coverage Analysis Best Practices

When helping users improve test coverage, combine coverage data with codebase exploration:

1. **Understand code utilization first**: Before targeting files by coverage percentage, explore which code is critical:
   - Find entry points (route definitions, event handlers, exported functions)
   - Find heavily-imported files (files imported by many others are high-value targets)
   - Identify critical business logic (auth, payments, data mutations)

2. **Prioritize by impact**: Low coverage alone doesn't indicate priority. Consider:
   - High utilization + low coverage = highest priority
   - Large files with 0% coverage have bigger impact than small files
   - Use find_uncovered_failure_areas for files with both low coverage AND test failures

3. **Use path-based queries**: The get_untested_files tool may return many files of a certain type (e.g., UI components). For targeted analysis, use get_coverage_for_file with path prefixes to focus on specific areas of the codebase.

4. **Iterate**: Get baseline → identify targets → write tests → re-check coverage after CI uploads new results.

## Finding Invisible Files

Coverage tools can only report on files that were loaded during test execution. Some files have 0% coverage but don't appear in reports at all - these are "invisible" files that were never imported.

To find invisible files:
1. Use get_coverage_for_file with a path prefix (e.g., "server/") to see what Gaffer tracks
2. Use the local Glob tool to list all source files in that path
3. Compare the lists - files in local but NOT in Gaffer are invisible
4. These files need tests that actually import them

Example: If get_coverage_for_file("server/api") returns user.ts, auth.ts, but Glob finds user.ts, auth.ts, billing.ts - then billing.ts is invisible and needs tests that import it.

## Agentic CI / Test Failure Diagnosis

When helping diagnose CI failures or fix failing tests:

1. **Check flakiness first**: Use get_flaky_tests to identify non-deterministic tests.
   Skip flaky tests unless the user specifically wants to stabilize them.

2. **Get failure details**: Use get_test_run_details with status='failed'
   to see error messages and stack traces for failing tests.

3. **Group by root cause**: Use get_failure_clusters to see which failures
   share the same underlying error — fix the root cause, not individual tests.

4. **Check history**: Use get_test_history to understand if the failure is new
   (regression) or recurring (existing bug).

5. **Verify fixes**: After code changes, use compare_test_metrics to confirm
   the specific test now passes.

6. **Prioritize by risk**: Use find_uncovered_failure_areas to identify
   which failing code has the lowest test coverage — fix those first.

## Checking Upload Status

When an agent needs to know if CI results are ready:

1. Use get_upload_status with commitSha or branch to find upload sessions
2. Check processingStatus: "completed" means results are ready, "processing" means wait
3. Once completed, use the linked testRunIds to get test results`,
    },
  )

  // Register all tools using the helper
  registerTool(server, client, {
    metadata: getProjectHealthMetadata,
    inputSchema: getProjectHealthInputSchema,
    outputSchema: getProjectHealthOutputSchema,
    execute: executeGetProjectHealth,
  })

  registerTool(server, client, {
    metadata: getTestHistoryMetadata,
    inputSchema: getTestHistoryInputSchema,
    outputSchema: getTestHistoryOutputSchema,
    execute: executeGetTestHistory,
  })

  registerTool(server, client, {
    metadata: getFlakyTestsMetadata,
    inputSchema: getFlakyTestsInputSchema,
    outputSchema: getFlakyTestsOutputSchema,
    execute: executeGetFlakyTests,
  })

  registerTool(server, client, {
    metadata: listTestRunsMetadata,
    inputSchema: listTestRunsInputSchema,
    outputSchema: listTestRunsOutputSchema,
    execute: executeListTestRuns,
  })

  if (client.isUserToken()) {
    registerTool(server, client, {
      metadata: listProjectsMetadata,
      inputSchema: listProjectsInputSchema,
      outputSchema: listProjectsOutputSchema,
      execute: executeListProjects,
    })
  }

  registerTool(server, client, {
    metadata: getReportMetadata,
    inputSchema: getReportInputSchema,
    outputSchema: getReportOutputSchema,
    execute: executeGetReport,
  })

  registerTool(server, client, {
    metadata: getSlowestTestsMetadata,
    inputSchema: getSlowestTestsInputSchema,
    outputSchema: getSlowestTestsOutputSchema,
    execute: executeGetSlowestTests,
  })

  registerTool(server, client, {
    metadata: getTestRunDetailsMetadata,
    inputSchema: getTestRunDetailsInputSchema,
    outputSchema: getTestRunDetailsOutputSchema,
    execute: executeGetTestRunDetails,
  })

  registerTool(server, client, {
    metadata: getFailureClustersMetadata,
    inputSchema: getFailureClustersInputSchema,
    outputSchema: getFailureClustersOutputSchema,
    execute: executeGetFailureClusters,
  })

  registerTool(server, client, {
    metadata: compareTestMetricsMetadata,
    inputSchema: compareTestMetricsInputSchema,
    outputSchema: compareTestMetricsOutputSchema,
    execute: executeCompareTestMetrics,
  })

  registerTool(server, client, {
    metadata: getCoverageSummaryMetadata,
    inputSchema: getCoverageSummaryInputSchema,
    outputSchema: getCoverageSummaryOutputSchema,
    execute: executeGetCoverageSummary,
  })

  registerTool(server, client, {
    metadata: getCoverageForFileMetadata,
    inputSchema: getCoverageForFileInputSchema,
    outputSchema: getCoverageForFileOutputSchema,
    execute: executeGetCoverageForFile,
  })

  registerTool(server, client, {
    metadata: findUncoveredFailureAreasMetadata,
    inputSchema: findUncoveredFailureAreasInputSchema,
    outputSchema: findUncoveredFailureAreasOutputSchema,
    execute: executeFindUncoveredFailureAreas,
  })

  registerTool(server, client, {
    metadata: getUntestedFilesMetadata,
    inputSchema: getUntestedFilesInputSchema,
    outputSchema: getUntestedFilesOutputSchema,
    execute: executeGetUntestedFiles,
  })

  registerTool(server, client, {
    metadata: getReportBrowserUrlMetadata,
    inputSchema: getReportBrowserUrlInputSchema,
    outputSchema: getReportBrowserUrlOutputSchema,
    execute: executeGetReportBrowserUrl,
  })

  registerTool(server, client, {
    metadata: getUploadStatusMetadata,
    inputSchema: getUploadStatusInputSchema,
    outputSchema: getUploadStatusOutputSchema,
    execute: executeGetUploadStatus,
  })

  // Connect via stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
