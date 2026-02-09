import type { GafferApiClient } from '../api-client.js'
import type { SlowestTestEntry, SlowestTestsResponse } from '../types.js'
import { z } from 'zod'

/**
 * Input schema for get_slowest_tests tool
 */
export const getSlowestTestsInputSchema = {
  projectId: z
    .string()
    .describe('Project ID to get slowest tests for. Required. Use list_projects to find project IDs.'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Analysis period in days (default: 30)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of tests to return (default: 20)'),
  framework: z
    .string()
    .optional()
    .describe('Filter by test framework (e.g., "playwright", "vitest", "jest")'),
  branch: z
    .string()
    .optional()
    .describe('Filter by git branch name (e.g., "main", "develop")'),
}

/**
 * Output schema for get_slowest_tests tool
 */
export const getSlowestTestsOutputSchema = {
  slowestTests: z.array(z.object({
    name: z.string(),
    fullName: z.string(),
    filePath: z.string().optional(),
    framework: z.string().optional(),
    avgDurationMs: z.number(),
    p95DurationMs: z.number(),
    runCount: z.number(),
  })),
  summary: z.object({
    projectId: z.string(),
    projectName: z.string(),
    period: z.number(),
    totalReturned: z.number(),
  }),
}

export interface GetSlowestTestsInput {
  projectId: string
  days?: number
  limit?: number
  framework?: string
  branch?: string
}

// Re-export types from types.ts for convenience
export type { SlowestTestEntry, SlowestTestsResponse }

// Output type matches SlowestTestsResponse
export type GetSlowestTestsOutput = SlowestTestsResponse

/**
 * Execute get_slowest_tests tool
 */
export async function executeGetSlowestTests(
  client: GafferApiClient,
  input: GetSlowestTestsInput,
): Promise<GetSlowestTestsOutput> {
  const response = await client.getSlowestTests({
    projectId: input.projectId,
    days: input.days,
    limit: input.limit,
    framework: input.framework,
    branch: input.branch,
  })

  return {
    slowestTests: response.slowestTests.map(test => ({
      name: test.name,
      fullName: test.fullName,
      filePath: test.filePath,
      framework: test.framework,
      avgDurationMs: test.avgDurationMs,
      p95DurationMs: test.p95DurationMs,
      runCount: test.runCount,
    })),
    summary: response.summary,
  }
}

/**
 * Tool metadata
 */
export const getSlowestTestsMetadata = {
  name: 'get_slowest_tests',
  title: 'Get Slowest Tests',
  description: `Get the slowest tests in a project, sorted by P95 duration.

When using a user API Key (gaf_), you must provide a projectId.
Use list_projects first to find available project IDs.

Parameters:
- projectId (required): Project ID to analyze
- days (optional): Analysis period in days (default: 30, max: 365)
- limit (optional): Max tests to return (default: 20, max: 100)
- framework (optional): Filter by framework (e.g., "playwright", "vitest")
- branch (optional): Filter by git branch (e.g., "main", "develop")

Returns:
- List of slowest tests with:
  - name: Short test name
  - fullName: Full test name including describe blocks
  - filePath: Test file path (if available)
  - framework: Test framework used
  - avgDurationMs: Average test duration in milliseconds
  - p95DurationMs: 95th percentile duration (used for sorting)
  - runCount: Number of times the test ran in the period
- Summary with project info and period

Use cases:
- "Which tests are slowing down my CI pipeline?"
- "Find the slowest Playwright tests to optimize"
- "Show me e2e tests taking over 30 seconds"
- "What are the slowest tests on the main branch?"`,
}
