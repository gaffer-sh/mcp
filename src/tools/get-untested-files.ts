import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_untested_files tool
 */
export const getUntestedFilesInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID. Required for user API keys (gaf_). Not needed for project tokens — omit and it resolves automatically.'),
  maxCoverage: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Maximum coverage percentage to include (default: 10 for "untested")'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of files to return (default: 20)'),
}

/**
 * Output schema for get_untested_files tool
 */
export const getUntestedFilesOutputSchema = {
  hasCoverage: z.boolean(),
  files: z.array(z.object({
    path: z.string(),
    lines: z.object({
      covered: z.number(),
      total: z.number(),
      percentage: z.number(),
    }),
    branches: z.object({
      covered: z.number(),
      total: z.number(),
      percentage: z.number(),
    }),
    functions: z.object({
      covered: z.number(),
      total: z.number(),
      percentage: z.number(),
    }),
  })),
  totalCount: z.number(),
  message: z.string().optional(),
}

export interface GetUntestedFilesInput {
  projectId?: string
  maxCoverage?: number
  limit?: number
}

export interface GetUntestedFilesOutput {
  hasCoverage: boolean
  files: Array<{
    path: string
    lines: { covered: number, total: number, percentage: number }
    branches: { covered: number, total: number, percentage: number }
    functions: { covered: number, total: number, percentage: number }
  }>
  totalCount: number
  message?: string
}

/**
 * Execute get_untested_files tool
 */
export async function executeGetUntestedFiles(
  client: GafferApiClient,
  input: GetUntestedFilesInput,
): Promise<GetUntestedFilesOutput> {
  const maxCoverage = input.maxCoverage ?? 10
  const limit = input.limit ?? 20

  const response = await client.getCoverageFiles({
    projectId: input.projectId,
    maxCoverage,
    limit,
    sortBy: 'coverage',
    sortOrder: 'asc', // Lowest coverage first
  })

  return {
    hasCoverage: response.hasCoverage,
    files: response.files.map(f => ({
      path: f.path,
      lines: f.lines,
      branches: f.branches,
      functions: f.functions,
    })),
    totalCount: response.pagination.total,
    message: response.message,
  }
}

/**
 * Tool metadata
 */
export const getUntestedFilesMetadata = {
  name: 'get_untested_files',
  title: 'Get Untested Files',
  description: `Get files with little or no test coverage.

Returns files sorted by coverage percentage (lowest first), filtered
to only include files below a coverage threshold.

Parameters:
- projectId: The project to analyze (required)
- maxCoverage: Include files with coverage at or below this % (default: 10)
- limit: Maximum number of files to return (default: 20, max: 100)

Returns:
- List of files sorted by coverage (lowest first)
- Each file includes line/branch/function coverage metrics
- Total count of files matching the criteria

IMPORTANT: Results may be dominated by certain file types (e.g., UI components) that are
numerous but not necessarily the highest priority. For targeted analysis of specific code
areas (backend, services, utilities), use get_coverage_for_file with path prefixes instead.

To prioritize effectively, explore the codebase to understand which code is heavily utilized
(entry points, frequently-imported files, critical business logic) and then query coverage
for those specific paths.`,
}
