import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_flaky_tests tool
 */
export const getFlakyTestsInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID to get flaky tests for. Required when using a user API Key (gaf_). Use list_projects to find project IDs.'),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe('Minimum flip rate to be considered flaky (0-1, default: 0.1 = 10%)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of flaky tests to return (default: 50)'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Analysis period in days (default: 30)'),
}

/**
 * Output schema for get_flaky_tests tool
 */
export const getFlakyTestsOutputSchema = {
  flakyTests: z.array(z.object({
    name: z.string(),
    flipRate: z.number(),
    flipCount: z.number(),
    totalRuns: z.number(),
    lastSeen: z.string(),
    flakinessScore: z.number(),
  })),
  summary: z.object({
    threshold: z.number(),
    totalFlaky: z.number(),
    period: z.number(),
  }),
}

export interface GetFlakyTestsInput {
  projectId?: string
  threshold?: number
  limit?: number
  days?: number
}

export interface GetFlakyTestsOutput {
  flakyTests: Array<{
    name: string
    flipRate: number
    flipCount: number
    totalRuns: number
    lastSeen: string
    flakinessScore: number
  }>
  summary: {
    threshold: number
    totalFlaky: number
    period: number
  }
}

/**
 * Execute get_flaky_tests tool
 */
export async function executeGetFlakyTests(
  client: GafferApiClient,
  input: GetFlakyTestsInput,
): Promise<GetFlakyTestsOutput> {
  const response = await client.getFlakyTests({
    projectId: input.projectId,
    threshold: input.threshold,
    limit: input.limit,
    days: input.days,
  })

  return {
    flakyTests: response.flakyTests,
    summary: response.summary,
  }
}

/**
 * Tool metadata
 */
export const getFlakyTestsMetadata = {
  name: 'get_flaky_tests',
  title: 'Get Flaky Tests',
  description: `Get the list of flaky tests in a project.

When using a user API Key (gaf_), you must provide a projectId.
Use list_projects first to find available project IDs.

A test is considered flaky if it frequently switches between pass and fail states.
Tests are ranked by a composite flakinessScore that factors in flip behavior,
failure rate, and duration variability.

Returns:
- List of flaky tests sorted by flakinessScore (most flaky first), with:
  - name: Test name
  - flipRate: How often the test flips between pass/fail (0-1)
  - flipCount: Number of status transitions
  - totalRuns: Total test executions analyzed
  - lastSeen: When the test last ran
  - flakinessScore: Composite score (0-1) combining flip proximity, failure rate, and duration variability
- Summary with threshold used and total count

Use this after get_project_health shows flaky tests exist, to identify which
specific tests are flaky and need investigation.`,
}
