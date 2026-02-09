import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_coverage_summary tool
 */
export const getCoverageSummaryInputSchema = {
  projectId: z
    .string()
    .describe('Project ID to get coverage for. Required. Use list_projects to find project IDs.'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Number of days to analyze for trends (default: 30)'),
}

/**
 * Output schema for get_coverage_summary tool
 */
export const getCoverageSummaryOutputSchema = {
  hasCoverage: z.boolean(),
  current: z.object({
    lines: z.number(),
    branches: z.number(),
    functions: z.number(),
  }).optional(),
  trend: z.object({
    direction: z.enum(['up', 'down', 'stable']),
    change: z.number(),
  }).optional(),
  totalReports: z.number(),
  latestReportDate: z.string().nullable().optional(),
  lowestCoverageFiles: z.array(z.object({
    path: z.string(),
    coverage: z.number(),
  })).optional(),
  message: z.string().optional(),
}

export interface GetCoverageSummaryInput {
  projectId: string
  days?: number
}

export interface GetCoverageSummaryOutput {
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
 * Execute get_coverage_summary tool
 */
export async function executeGetCoverageSummary(
  client: GafferApiClient,
  input: GetCoverageSummaryInput,
): Promise<GetCoverageSummaryOutput> {
  const response = await client.getCoverageSummary({
    projectId: input.projectId,
    days: input.days,
  })

  return {
    hasCoverage: response.hasCoverage,
    current: response.current,
    trend: response.trend,
    totalReports: response.totalReports,
    latestReportDate: response.latestReportDate,
    lowestCoverageFiles: response.lowestCoverageFiles,
    message: response.message,
  }
}

/**
 * Tool metadata
 */
export const getCoverageSummaryMetadata = {
  name: 'get_coverage_summary',
  title: 'Get Coverage Summary',
  description: `Get the coverage metrics summary for a project.

When using a user API Key (gaf_), you must provide a projectId.
Use list_projects first to find available project IDs.

Returns:
- Current coverage percentages (lines, branches, functions)
- Trend direction (up, down, stable) and change amount
- Total number of coverage reports
- Latest report date
- Top 5 files with lowest coverage

Use this to understand your project's overall test coverage health.

After getting the summary, use get_coverage_for_file with path prefixes to drill into
specific areas (e.g., "server/services", "src/api", "lib/core"). This helps identify
high-value targets in critical code paths rather than just the files with lowest coverage.`,
}
