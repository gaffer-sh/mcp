import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for search_failures tool
 */
export const searchFailuresInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID. Required for user API keys (gaf_). Not needed for project tokens — omit and it resolves automatically.'),
  query: z
    .string()
    .min(1)
    .describe('Search query to match against failure messages, error stacks, or test names.'),
  searchIn: z
    .enum(['errors', 'names', 'all'])
    .optional()
    .describe('Where to search: "errors" (error messages and stacks), "names" (test names), or "all" (default: "all").'),
  days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe('Number of days to search back (default: 30)'),
  branch: z
    .string()
    .optional()
    .describe('Filter to a specific branch'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of matches to return (default: 20)'),
}

/**
 * Output schema for search_failures tool
 */
export const searchFailuresOutputSchema = {
  matches: z.array(z.object({
    testName: z.string(),
    testRunId: z.string(),
    branch: z.string().nullable(),
    commitSha: z.string().nullable(),
    errorMessage: z.string().nullable(),
    errorStack: z.string().nullable(),
    createdAt: z.string(),
  })),
  total: z.number(),
  query: z.string(),
}

export interface SearchFailuresInput {
  projectId?: string
  query: string
  searchIn?: 'errors' | 'names' | 'all'
  days?: number
  branch?: string
  limit?: number
}

export interface SearchFailuresOutput {
  matches: Array<{
    testName: string
    testRunId: string
    branch: string | null
    commitSha: string | null
    errorMessage: string | null
    errorStack: string | null
    createdAt: string
  }>
  total: number
  query: string
}

/**
 * Execute search_failures tool
 */
export async function executeSearchFailures(
  client: GafferApiClient,
  input: SearchFailuresInput,
): Promise<SearchFailuresOutput> {
  return client.searchFailures(input)
}

/**
 * Tool metadata
 */
export const searchFailuresMetadata = {
  name: 'search_failures',
  title: 'Search Failures',
  description: `Search across test failures by error message, stack trace, or test name.

Use this to find specific failures across test runs — like grep for your test history.

Examples:
- "TypeError: Cannot read properties of undefined" → find all occurrences of this error
- "timeout" → find timeout-related failures
- "auth" with searchIn="names" → find failing auth tests

Returns matching failures with test run context (branch, commit, timestamp) for investigation.`,
}
