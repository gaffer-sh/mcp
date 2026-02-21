import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_test_run_details tool
 */
export const getTestRunDetailsInputSchema = {
  testRunId: z
    .string()
    .describe('The test run ID to get details for. Use list_test_runs to find test run IDs.'),
  projectId: z
    .string()
    .optional()
    .describe('Project ID. Required for user API keys (gaf_). Not needed for project tokens — omit and it resolves automatically.'),
  status: z
    .enum(['passed', 'failed', 'skipped'])
    .optional()
    .describe('Filter tests by status. Returns only tests matching this status.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Maximum number of tests to return (default: 100, max: 500)'),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Number of tests to skip for pagination (default: 0)'),
}

/**
 * Output schema for get_test_run_details tool
 */
export const getTestRunDetailsOutputSchema = {
  testRunId: z.string(),
  commitSha: z.string().nullable(),
  branch: z.string().nullable(),
  framework: z.string().nullable(),
  createdAt: z.string(),
  summary: z.object({
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    total: z.number(),
  }),
  tests: z.array(z.object({
    name: z.string(),
    fullName: z.string(),
    status: z.enum(['passed', 'failed', 'skipped']),
    durationMs: z.number().nullable(),
    filePath: z.string().nullable(),
    error: z.string().nullable(),
    errorStack: z.string().nullable(),
  })),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
}

export interface GetTestRunDetailsInput {
  testRunId: string
  projectId?: string
  status?: 'passed' | 'failed' | 'skipped'
  limit?: number
  offset?: number
}

export interface GetTestRunDetailsOutput {
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
  tests: Array<{
    name: string
    fullName: string
    status: 'passed' | 'failed' | 'skipped'
    durationMs: number | null
    filePath: string | null
    error: string | null
    errorStack: string | null
  }>
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

/**
 * Execute get_test_run_details tool
 */
export async function executeGetTestRunDetails(
  client: GafferApiClient,
  input: GetTestRunDetailsInput,
): Promise<GetTestRunDetailsOutput> {
  const response = await client.getTestRunDetails({
    projectId: input.projectId,
    testRunId: input.testRunId,
    status: input.status,
    limit: input.limit,
    offset: input.offset,
  })

  return {
    testRunId: response.testRunId,
    commitSha: response.commitSha,
    branch: response.branch,
    framework: response.framework,
    createdAt: response.createdAt,
    summary: response.summary,
    tests: response.tests,
    pagination: response.pagination,
  }
}

/**
 * Tool metadata
 */
export const getTestRunDetailsMetadata = {
  name: 'get_test_run_details',
  title: 'Get Test Run Details',
  description: `Get parsed test results for a specific test run.

Parameters:
- testRunId (required): The test run ID to get details for
- projectId (required): Project ID the test run belongs to
- status (optional): Filter by test status: "passed", "failed", or "skipped"
- limit (optional): Max tests to return (default: 100, max: 500)
- offset (optional): Pagination offset (default: 0)

Returns:
- testRunId: The test run ID
- commitSha: Git commit SHA (null if not recorded)
- branch: Git branch name (null if not recorded)
- framework: Test framework (e.g., "playwright", "vitest")
- createdAt: When the test run was created (ISO 8601)
- summary: Overall counts (passed, failed, skipped, total)
- tests: Array of individual test results with:
  - name: Short test name
  - fullName: Full test name including describe blocks
  - status: Test status (passed, failed, skipped)
  - durationMs: Test duration in milliseconds (null if not recorded)
  - filePath: Test file path (null if not recorded)
  - error: Error message for failed tests (null otherwise)
  - errorStack: Full stack trace for failed tests (null otherwise)
- pagination: Pagination info (total, limit, offset, hasMore)

Use cases:
- "Show me all failed tests from this test run"
- "Get the test results from commit abc123"
- "List tests that took the longest in this run"
- "Find tests with errors in the auth module"

Note: For aggregate analytics like flaky test detection or duration trends,
use get_test_history, get_flaky_tests, or get_slowest_tests instead.`,
}
