import type { GafferApiClient } from '../api-client.js'
import type { FailureClustersResponse } from '../types.js'
import { z } from 'zod'

/**
 * Input schema for get_failure_clusters tool
 */
export const getFailureClustersInputSchema = {
  projectId: z
    .string()
    .describe('Project ID. Use list_projects to find project IDs.'),
  testRunId: z
    .string()
    .describe('Test run ID. Use list_test_runs to find test run IDs.'),
}

/**
 * Output schema for get_failure_clusters tool
 */
export const getFailureClustersOutputSchema = {
  clusters: z.array(z.object({
    representativeError: z.string(),
    count: z.number(),
    tests: z.array(z.object({
      name: z.string(),
      fullName: z.string(),
      errorMessage: z.string(),
      filePath: z.string().nullable(),
    })),
    similarity: z.number(),
  })),
  totalFailures: z.number(),
}

export interface GetFailureClustersInput {
  projectId: string
  testRunId: string
}

/**
 * Execute get_failure_clusters tool
 */
export async function executeGetFailureClusters(
  client: GafferApiClient,
  input: GetFailureClustersInput,
): Promise<FailureClustersResponse> {
  return client.getFailureClusters({
    projectId: input.projectId,
    testRunId: input.testRunId,
  })
}

/**
 * Tool metadata
 */
export const getFailureClustersMetadata = {
  name: 'get_failure_clusters',
  title: 'Get Failure Clusters',
  description: `Group failed tests by root cause using error message similarity.

Parameters:
- projectId (required): The project ID
- testRunId (required): The test run ID to analyze

Returns:
- clusters: Array of failure clusters, each containing:
  - representativeError: The error message representing this cluster
  - count: Number of tests with this same root cause
  - tests: Array of individual failed tests in this cluster
    - name: Short test name
    - fullName: Full test name including describe blocks
    - errorMessage: The specific error message
    - filePath: Test file path (null if not recorded)
  - similarity: Similarity threshold used for clustering (0-1)
- totalFailures: Total number of failed tests across all clusters

Use cases:
- "Group these 15 failures by root cause" — often reveals 2-3 distinct bugs
- "Which error affects the most tests?" — fix the largest cluster first
- "Are these failures related?" — check if they land in the same cluster

Tip: Use get_test_run_details with status='failed' first to see raw failures,
then use this tool to understand which failures share the same root cause.`,
}
