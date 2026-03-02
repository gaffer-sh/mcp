import type { FunctionRegistry } from './registry.js'
import type { SearchResult } from './types.js'
import { z } from 'zod'

export const searchToolsInputSchema = {
  query: z
    .string()
    .optional()
    .describe('Search query to find relevant functions. Leave empty to list all available functions.'),
}

export interface SearchToolsInput {
  query?: string
}

/**
 * Execute search_tools: find functions by keyword matching
 */
export function executeSearchTools(
  registry: FunctionRegistry,
  input: SearchToolsInput,
): { functions: SearchResult[] } {
  const results = input.query ? registry.search(input.query) : registry.listAll()
  return { functions: results }
}

export const searchToolsMetadata = {
  name: 'search_tools',
  title: 'Search Tools',
  description: `Search for available Gaffer API functions by keyword.

Returns matching functions with their TypeScript declarations so you can use them with execute_code.

Examples:
- "coverage" → coverage-related functions
- "flaky" → flaky test detection
- "failure" → failure analysis functions
- "" (empty) → list all available functions`,
}
