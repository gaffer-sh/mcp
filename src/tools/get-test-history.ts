import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_test_history tool
 */
export const getTestHistoryInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID to get test history for. Required when using a user API Key (gaf_). Use list_projects to find project IDs.'),
  testName: z
    .string()
    .optional()
    .describe('Exact test name to search for'),
  filePath: z
    .string()
    .optional()
    .describe('File path containing the test'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of results (default: 20)'),
}

/**
 * Output schema for get_test_history tool
 */
export const getTestHistoryOutputSchema = {
  history: z.array(z.object({
    testRunId: z.string(),
    createdAt: z.string(),
    branch: z.string().optional(),
    commitSha: z.string().optional(),
    status: z.enum(['passed', 'failed', 'skipped', 'pending']),
    durationMs: z.number(),
    message: z.string().optional(),
  })),
  summary: z.object({
    totalRuns: z.number(),
    passedRuns: z.number(),
    failedRuns: z.number(),
    passRate: z.number().nullable(),
  }),
}

export interface GetTestHistoryInput {
  projectId?: string
  testName?: string
  filePath?: string
  limit?: number
}

export interface GetTestHistoryOutput {
  history: Array<{
    testRunId: string
    createdAt: string
    branch?: string
    commitSha?: string
    status: 'passed' | 'failed' | 'skipped' | 'pending'
    durationMs: number
    message?: string
  }>
  summary: {
    totalRuns: number
    passedRuns: number
    failedRuns: number
    passRate: number | null
  }
}

/**
 * Execute get_test_history tool
 */
export async function executeGetTestHistory(
  client: GafferApiClient,
  input: GetTestHistoryInput,
): Promise<GetTestHistoryOutput> {
  if (!input.testName && !input.filePath) {
    throw new Error('Either testName or filePath is required')
  }

  const response = await client.getTestHistory({
    projectId: input.projectId,
    testName: input.testName,
    filePath: input.filePath,
    limit: input.limit || 20,
  })

  return {
    history: response.history.map(entry => ({
      testRunId: entry.testRunId,
      createdAt: entry.createdAt,
      branch: entry.branch,
      commitSha: entry.commitSha,
      status: entry.test.status,
      durationMs: entry.test.durationMs,
      message: entry.test.message || undefined, // Convert null to undefined for schema compliance
    })),
    summary: {
      totalRuns: response.summary.totalRuns,
      passedRuns: response.summary.passedRuns,
      failedRuns: response.summary.failedRuns,
      passRate: response.summary.passRate,
    },
  }
}

/**
 * Tool metadata
 */
export const getTestHistoryMetadata = {
  name: 'get_test_history',
  title: 'Get Test History',
  description: `Get the pass/fail history for a specific test.

When using a user API Key (gaf_), you must provide a projectId.
Use list_projects first to find available project IDs.

Search by either:
- testName: The exact name of the test (e.g., "should handle user login")
- filePath: The file path containing the test (e.g., "tests/auth.test.ts")

Returns:
- History of test runs showing pass/fail status over time
- Duration of each run
- Branch and commit information
- Error messages for failed runs
- Summary statistics (pass rate, total runs)

Use this to investigate flaky tests or understand test stability.`,
}
