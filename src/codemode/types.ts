import type { z } from 'zod'
import type { GafferApiClient } from '../api-client.js'

/**
 * A function registered in the codemode registry.
 * Each entry wraps an existing tool's execute function with metadata for discovery.
 */
export interface FunctionEntry {
  /** Function name as exposed in the codemode namespace (e.g., "get_project_health") */
  name: string
  /** Human-readable description for LLM context */
  description: string
  /** Category for grouping in search (e.g., "health", "testing", "coverage") */
  category: string
  /** Keywords for search scoring */
  keywords: string[]
  /** Zod input schema (object shape, not wrapped in z.object) */
  inputSchema: Record<string, z.ZodTypeAny>
  /** The execute function from the original tool */
  execute: (client: GafferApiClient, input: any) => Promise<any>
}

/**
 * Result from searching the function registry
 */
export interface SearchResult {
  name: string
  description: string
  category: string
  /** TypeScript declaration for this function */
  declaration: string
}

/**
 * Result from executing user code via the codemode executor
 */
export interface ExecutionResult {
  /** The return value of the executed code */
  result: unknown
  /** Captured console output (log, warn, error) */
  logs: string[]
  /** Execution duration in milliseconds */
  durationMs: number
}
