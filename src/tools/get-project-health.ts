import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_project_health tool
 */
export const getProjectHealthInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID to get health for. Required when using a user API Key (gaf_). Use list_projects to find project IDs.'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Number of days to analyze (default: 30)'),
}

/**
 * Output schema for get_project_health tool
 */
export const getProjectHealthOutputSchema = {
  projectName: z.string(),
  healthScore: z.number(),
  passRate: z.number().nullable(),
  testRunCount: z.number(),
  flakyTestCount: z.number(),
  trend: z.enum(['up', 'down', 'stable']),
  period: z.object({
    days: z.number(),
    start: z.string(),
    end: z.string(),
  }),
}

export interface GetProjectHealthInput {
  projectId?: string
  days?: number
}

export interface GetProjectHealthOutput {
  projectName: string
  healthScore: number
  passRate: number | null
  testRunCount: number
  flakyTestCount: number
  trend: 'up' | 'down' | 'stable'
  period: {
    days: number
    start: string
    end: string
  }
}

/**
 * Execute get_project_health tool
 */
export async function executeGetProjectHealth(
  client: GafferApiClient,
  input: GetProjectHealthInput,
): Promise<GetProjectHealthOutput> {
  const response = await client.getProjectHealth({
    projectId: input.projectId,
    days: input.days,
  })

  return {
    projectName: response.analytics.projectName,
    healthScore: response.analytics.healthScore,
    passRate: response.analytics.passRate,
    testRunCount: response.analytics.testRunCount,
    flakyTestCount: response.analytics.flakyTestCount,
    trend: response.analytics.trend,
    period: response.analytics.period,
  }
}

/**
 * Tool metadata
 */
export const getProjectHealthMetadata = {
  name: 'get_project_health',
  title: 'Get Project Health',
  description: `Get the health metrics for a project.

When using a user API Key (gaf_), you must provide a projectId.
Use list_projects first to find available project IDs.

Returns:
- Health score (0-100): Overall project health based on pass rate and trend
- Pass rate: Percentage of tests passing
- Test run count: Number of test runs in the period
- Flaky test count: Number of tests with inconsistent results
- Trend: Whether test health is improving (up), declining (down), or stable

Use this to understand the current state of your test suite.`,
}
