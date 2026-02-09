import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_coverage_for_file tool
 */
export const getCoverageForFileInputSchema = {
  projectId: z
    .string()
    .describe('Project ID to get coverage for. Required. Use list_projects to find project IDs.'),
  filePath: z
    .string()
    .describe('File path to get coverage for. Can be exact path or partial match.'),
}

/**
 * Output schema for get_coverage_for_file tool
 */
export const getCoverageForFileOutputSchema = {
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
  message: z.string().optional(),
}

export interface GetCoverageForFileInput {
  projectId: string
  filePath: string
}

export interface GetCoverageForFileOutput {
  hasCoverage: boolean
  files: Array<{
    path: string
    lines: { covered: number, total: number, percentage: number }
    branches: { covered: number, total: number, percentage: number }
    functions: { covered: number, total: number, percentage: number }
  }>
  message?: string
}

/**
 * Execute get_coverage_for_file tool
 */
export async function executeGetCoverageForFile(
  client: GafferApiClient,
  input: GetCoverageForFileInput,
): Promise<GetCoverageForFileOutput> {
  const response = await client.getCoverageFiles({
    projectId: input.projectId,
    filePath: input.filePath,
    limit: 10, // Return up to 10 matching files
  })

  return {
    hasCoverage: response.hasCoverage,
    files: response.files.map(f => ({
      path: f.path,
      lines: f.lines,
      branches: f.branches,
      functions: f.functions,
    })),
    message: response.message,
  }
}

/**
 * Tool metadata
 */
export const getCoverageForFileMetadata = {
  name: 'get_coverage_for_file',
  title: 'Get Coverage for File',
  description: `Get coverage metrics for a specific file or files matching a path pattern.

When using a user API Key (gaf_), you must provide a projectId.
Use list_projects first to find available project IDs.

Parameters:
- projectId: The project to query (required)
- filePath: File path to search for (exact or partial match)

Returns:
- Line coverage (covered/total/percentage)
- Branch coverage (covered/total/percentage)
- Function coverage (covered/total/percentage)

This is the preferred tool for targeted coverage analysis. Use path prefixes to focus on
specific areas of the codebase:
- "server/services" - Backend service layer
- "server/utils" - Backend utilities
- "src/api" - API routes
- "lib/core" - Core business logic

Before querying, explore the codebase to identify critical paths - entry points,
heavily-imported files, and code handling auth/payments/data mutations.
Prioritize: high utilization + low coverage = highest impact.`,
}
