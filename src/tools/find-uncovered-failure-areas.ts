import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for find_uncovered_failure_areas tool
 */
export const findUncoveredFailureAreasInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID. Required for user API keys (gaf_). Not needed for project tokens — omit and it resolves automatically.'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Number of days to analyze for test failures (default: 30)'),
  coverageThreshold: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Include files with coverage below this percentage (default: 80)'),
}

/**
 * Output schema for find_uncovered_failure_areas tool
 */
export const findUncoveredFailureAreasOutputSchema = {
  hasCoverage: z.boolean(),
  hasTestResults: z.boolean(),
  riskAreas: z.array(z.object({
    filePath: z.string(),
    coverage: z.number(),
    failureCount: z.number(),
    riskScore: z.number(),
    testNames: z.array(z.string()),
  })),
  message: z.string().optional(),
}

export interface FindUncoveredFailureAreasInput {
  projectId?: string
  days?: number
  coverageThreshold?: number
}

export interface FindUncoveredFailureAreasOutput {
  hasCoverage: boolean
  hasTestResults: boolean
  riskAreas: Array<{
    filePath: string
    coverage: number
    failureCount: number
    riskScore: number
    testNames: string[]
  }>
  message?: string
}

/**
 * Execute find_uncovered_failure_areas tool
 */
export async function executeFindUncoveredFailureAreas(
  client: GafferApiClient,
  input: FindUncoveredFailureAreasInput,
): Promise<FindUncoveredFailureAreasOutput> {
  const response = await client.getCoverageRiskAreas({
    projectId: input.projectId,
    days: input.days,
    coverageThreshold: input.coverageThreshold,
  })

  return {
    hasCoverage: response.hasCoverage,
    hasTestResults: response.hasTestResults,
    riskAreas: response.riskAreas,
    message: response.message,
  }
}

/**
 * Tool metadata
 */
export const findUncoveredFailureAreasMetadata = {
  name: 'find_uncovered_failure_areas',
  title: 'Find Uncovered Failure Areas',
  description: `Find areas of code that have both low coverage AND test failures.

This cross-references test failures with coverage data to identify high-risk
areas in your codebase that need attention. Files are ranked by a "risk score"
calculated as: (100 - coverage%) × failureCount.

Parameters:
- projectId: The project to analyze (required)
- days: Analysis period for test failures (default: 30)
- coverageThreshold: Include files below this coverage % (default: 80)

Returns:
- List of risk areas sorted by risk score (highest risk first)
- Each area includes: file path, coverage %, failure count, risk score, test names

Use this to prioritize which parts of your codebase need better test coverage.`,
}
