import type { GafferApiClient } from '../api-client.js'
import type { CompareTestResponse } from '../types.js'
import { z } from 'zod'

/**
 * Input schema for compare_test_metrics tool
 */
export const compareTestMetricsInputSchema = {
  projectId: z
    .string()
    .describe('Project ID. Use list_projects to find project IDs.'),
  testName: z
    .string()
    .describe('The test name to compare. Can be the short name or full name including describe blocks.'),
  beforeCommit: z
    .string()
    .optional()
    .describe('Commit SHA for the "before" measurement. Use with afterCommit.'),
  afterCommit: z
    .string()
    .optional()
    .describe('Commit SHA for the "after" measurement. Use with beforeCommit.'),
  beforeRunId: z
    .string()
    .optional()
    .describe('Test run ID for the "before" measurement. Use with afterRunId.'),
  afterRunId: z
    .string()
    .optional()
    .describe('Test run ID for the "after" measurement. Use with beforeRunId.'),
}

/**
 * Output schema for compare_test_metrics tool
 */
export const compareTestMetricsOutputSchema = {
  testName: z.string(),
  before: z.object({
    testRunId: z.string(),
    commit: z.string().nullable(),
    branch: z.string().nullable(),
    status: z.enum(['passed', 'failed', 'skipped']),
    durationMs: z.number().nullable(),
    createdAt: z.string(),
  }),
  after: z.object({
    testRunId: z.string(),
    commit: z.string().nullable(),
    branch: z.string().nullable(),
    status: z.enum(['passed', 'failed', 'skipped']),
    durationMs: z.number().nullable(),
    createdAt: z.string(),
  }),
  change: z.object({
    durationMs: z.number().nullable(),
    percentChange: z.number().nullable(),
    statusChanged: z.boolean(),
  }),
}

export interface CompareTestMetricsInput {
  projectId: string
  testName: string
  beforeCommit?: string
  afterCommit?: string
  beforeRunId?: string
  afterRunId?: string
}

// Re-export response type from types.ts for convenience
export type CompareTestMetricsOutput = CompareTestResponse

/**
 * Execute compare_test_metrics tool
 */
export async function executeCompareTestMetrics(
  client: GafferApiClient,
  input: CompareTestMetricsInput,
): Promise<CompareTestMetricsOutput> {
  // Validate input - check for presence of required pairs
  const hasCommits = input.beforeCommit && input.afterCommit
  const hasRunIds = input.beforeRunId && input.afterRunId

  if (!hasCommits && !hasRunIds) {
    throw new Error('Must provide either (beforeCommit + afterCommit) or (beforeRunId + afterRunId)')
  }

  // Validate non-empty strings
  if (hasCommits) {
    if (input.beforeCommit!.trim().length === 0 || input.afterCommit!.trim().length === 0) {
      throw new Error('beforeCommit and afterCommit must not be empty strings')
    }
  }

  if (hasRunIds) {
    if (input.beforeRunId!.trim().length === 0 || input.afterRunId!.trim().length === 0) {
      throw new Error('beforeRunId and afterRunId must not be empty strings')
    }
  }

  const response = await client.compareTestMetrics({
    projectId: input.projectId,
    testName: input.testName,
    beforeCommit: input.beforeCommit,
    afterCommit: input.afterCommit,
    beforeRunId: input.beforeRunId,
    afterRunId: input.afterRunId,
  })

  return response
}

/**
 * Tool metadata
 */
export const compareTestMetricsMetadata = {
  name: 'compare_test_metrics',
  title: 'Compare Test Metrics',
  description: `Compare test metrics between two commits or test runs.

Useful for measuring the impact of code changes on test performance or reliability.

Parameters:
- projectId (required): Project ID
- testName (required): The test name to compare (short name or full name)
- Option 1 - Compare by commit:
  - beforeCommit: Commit SHA for "before" measurement
  - afterCommit: Commit SHA for "after" measurement
- Option 2 - Compare by test run:
  - beforeRunId: Test run ID for "before" measurement
  - afterRunId: Test run ID for "after" measurement

Returns:
- testName: The test that was compared
- before: Metrics from the before commit/run
  - testRunId, commit, branch, status, durationMs, createdAt
- after: Metrics from the after commit/run
  - testRunId, commit, branch, status, durationMs, createdAt
- change: Calculated changes
  - durationMs: Duration difference (negative = faster)
  - percentChange: Percentage change (negative = improvement)
  - statusChanged: Whether pass/fail status changed

Use cases:
- "Did my fix make this test faster?"
- "Compare test performance between these two commits"
- "Did this test start failing after my changes?"
- "Show me the before/after for the slow test I optimized"

Tip: Use get_test_history first to find the commit SHAs or test run IDs you want to compare.`,
}
