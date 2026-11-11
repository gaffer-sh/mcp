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
    .optional()
    .describe('Search query to match against failure messages, error stacks, or test names. Omit to return every failure in the window.'),
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
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Number of matches to skip for pagination (default: 0)'),
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
    errorStack: z.string().nullable().describe('Full stack trace, not truncated'),
    createdAt: z.string(),
  })),
  total: z.number(),
  truncated: z.boolean(),
  query: z.string().nullable(),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }).optional(),
}

export interface SearchFailuresInput {
  projectId?: string
  query?: string
  searchIn?: 'errors' | 'names' | 'all'
  days?: number
  branch?: string
  limit?: number
  offset?: number
}

export interface SearchFailuresOutput {
  matches: Array<{
    testName: string
    testRunId: string
    branch: string | null
    commitSha: string | null
    errorMessage: string | null
    /** Full stack trace, not truncated */
    errorStack: string | null
    createdAt: string
  }>
  total: number
  truncated: boolean
  query: string | null
  pagination?: {
    limit: number
    offset: number
    hasMore: boolean
  }
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
  description: `Search across test failures by error message, stack trace, or test name, or list them all.

Use this to find specific failures across test runs — like grep for your test history.

Examples:
- "TypeError: Cannot read properties of undefined" → find all occurrences of this error
- "timeout" → find timeout-related failures
- "auth" with searchIn="names" → find failing auth tests
- no query, days=7 → everything that failed in the last week

Returns matching failures with test run context (branch, commit, timestamp) and the full error stack for investigation.
\`pagination.hasMore\` is true when more matches exist; pass \`offset\` to page through them.
\`truncated\` is true when the scan caps cut the list short — narrow by branch or shorten \`days\`.`,
}
