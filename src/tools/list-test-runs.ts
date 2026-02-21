import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for list_test_runs tool
 */
export const listTestRunsInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID. Required for user API keys (gaf_). Not needed for project tokens — omit and it resolves automatically.'),
  commitSha: z
    .string()
    .optional()
    .describe('Filter by commit SHA (exact or prefix match)'),
  branch: z
    .string()
    .optional()
    .describe('Filter by branch name'),
  status: z
    .enum(['passed', 'failed'])
    .optional()
    .describe('Filter by status: "passed" (no failures) or "failed" (has failures)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of test runs to return (default: 20)'),
}

/**
 * Output schema for list_test_runs tool
 */
export const listTestRunsOutputSchema = {
  testRuns: z.array(z.object({
    id: z.string(),
    commitSha: z.string().optional(),
    branch: z.string().optional(),
    passedCount: z.number(),
    failedCount: z.number(),
    skippedCount: z.number(),
    totalCount: z.number(),
    createdAt: z.string(),
  })),
  pagination: z.object({
    total: z.number(),
    hasMore: z.boolean(),
  }),
}

export interface ListTestRunsInput {
  projectId?: string
  commitSha?: string
  branch?: string
  status?: 'passed' | 'failed'
  limit?: number
}

export interface ListTestRunsOutput {
  testRuns: Array<{
    id: string
    commitSha?: string
    branch?: string
    passedCount: number
    failedCount: number
    skippedCount: number
    totalCount: number
    createdAt: string
  }>
  pagination: {
    total: number
    hasMore: boolean
  }
}

/**
 * Execute list_test_runs tool
 */
export async function executeListTestRuns(
  client: GafferApiClient,
  input: ListTestRunsInput,
): Promise<ListTestRunsOutput> {
  const response = await client.getTestRuns({
    projectId: input.projectId,
    commitSha: input.commitSha,
    branch: input.branch,
    status: input.status,
    limit: input.limit || 20,
  })

  return {
    testRuns: response.testRuns.map(run => ({
      id: run.id,
      commitSha: run.commitSha || undefined,
      branch: run.branch || undefined,
      passedCount: run.summary.passed,
      failedCount: run.summary.failed,
      skippedCount: run.summary.skipped,
      totalCount: run.summary.total,
      createdAt: run.createdAt,
    })),
    pagination: {
      total: response.pagination.total,
      hasMore: response.pagination.hasMore,
    },
  }
}

/**
 * Tool metadata
 */
export const listTestRunsMetadata = {
  name: 'list_test_runs',
  title: 'List Test Runs',
  description: `List recent test runs for a project with optional filtering.

Filter by:
- commitSha: Filter by commit SHA (supports prefix matching)
- branch: Filter by branch name
- status: Filter by "passed" (no failures) or "failed" (has failures)

Returns:
- List of test runs with:
  - id: Test run ID (can be used with get_test_run for details)
  - commitSha: Git commit SHA
  - branch: Git branch name
  - passedCount/failedCount/skippedCount: Test counts
  - createdAt: When the test run was created
- Pagination info (total count, hasMore flag)

Use cases:
- "What tests failed in commit abc123?"
- "Show me recent test runs on main branch"
- "What's the status of tests on my feature branch?"`,
}
