import type { GafferApiClient } from '../api-client.js'
import type { FunctionEntry, SearchResult } from './types.js'
import { z } from 'zod'
import { generateDeclaration } from './type-gen.js'

/**
 * Registry of codemode functions.
 * Wraps existing tool execute functions with metadata for discovery and namespace building.
 */
export class FunctionRegistry {
  private entries: Map<string, FunctionEntry> = new Map()

  /**
   * Register a function in the registry
   */
  register(entry: FunctionEntry): void {
    this.entries.set(entry.name, entry)
  }

  /**
   * Get all registered function entries
   */
  getAll(): FunctionEntry[] {
    return Array.from(this.entries.values())
  }

  /**
   * Get a single entry by name
   */
  get(name: string): FunctionEntry | undefined {
    return this.entries.get(name)
  }

  /**
   * Build the namespace object that gets injected into the executor.
   * Each function validates input via Zod then calls the tool's execute function.
   */
  buildNamespace(client: GafferApiClient): Record<string, (...args: any[]) => Promise<any>> {
    const namespace: Record<string, (...args: any[]) => Promise<any>> = {}

    for (const entry of this.entries.values()) {
      namespace[entry.name] = async (input: any = {}) => {
        const schema = z.object(entry.inputSchema)
        const result = schema.safeParse(input)
        if (!result.success) {
          const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
          throw new Error(`Invalid input for ${entry.name}: ${issues}`)
        }
        try {
          return await entry.execute(client, result.data)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          throw new Error(`${entry.name} failed: ${message}`, { cause: error })
        }
      }
    }

    return namespace
  }

  /**
   * Generate TypeScript declarations for all registered functions.
   * Used in the execute_code tool description so the LLM knows available functions.
   */
  generateAllDeclarations(): string {
    return this.getAll()
      .map(entry => generateDeclaration(entry.name, entry.description, entry.inputSchema))
      .join('\n\n')
  }

  /**
   * Generate a declaration for a single function
   */
  generateDeclaration(name: string): string | null {
    const entry = this.entries.get(name)
    if (!entry)
      return null
    return generateDeclaration(entry.name, entry.description, entry.inputSchema)
  }

  /**
   * Search for functions matching a query.
   * Scores: name match (10) > category match (5) > keyword match (3) > description match (1)
   */
  search(query: string): SearchResult[] {
    if (!query.trim()) {
      return this.listAll()
    }

    const terms = query.toLowerCase().split(/\s+/)
    const scored: Array<{ entry: FunctionEntry, score: number }> = []

    for (const entry of this.entries.values()) {
      let score = 0
      const nameLower = entry.name.toLowerCase()
      const categoryLower = entry.category.toLowerCase()
      const descLower = entry.description.toLowerCase()
      const keywordsLower = entry.keywords.map(k => k.toLowerCase())

      for (const term of terms) {
        if (nameLower.includes(term))
          score += 10
        if (categoryLower.includes(term))
          score += 5
        if (keywordsLower.some(k => k.includes(term)))
          score += 3
        if (descLower.includes(term))
          score += 1
      }

      if (score > 0) {
        scored.push({ entry, score })
      }
    }

    scored.sort((a, b) => b.score - a.score)

    return scored.map(({ entry }) => this.toSearchResult(entry))
  }

  /**
   * List all functions (used when search query is empty)
   */
  listAll(): SearchResult[] {
    return Array.from(this.entries.values()).map(entry => this.toSearchResult(entry))
  }

  private toSearchResult(entry: FunctionEntry): SearchResult {
    return {
      name: entry.name,
      description: entry.description,
      category: entry.category,
      declaration: generateDeclaration(entry.name, entry.description, entry.inputSchema),
    }
  }
}
