import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { FunctionRegistry } from '../registry.js'
import { executeSearchTools } from '../search.js'

function buildRegistry(): FunctionRegistry {
  const registry = new FunctionRegistry()
  registry.register({
    name: 'get_project_health',
    description: 'Get health metrics for a project',
    category: 'health',
    keywords: ['health', 'score'],
    inputSchema: { projectId: z.string().optional() },
    execute: vi.fn(),
  })
  registry.register({
    name: 'get_coverage_summary',
    description: 'Get coverage summary',
    category: 'coverage',
    keywords: ['coverage', 'lines'],
    inputSchema: { projectId: z.string().optional() },
    execute: vi.fn(),
  })
  return registry
}

describe('executeSearchTools', () => {
  it('returns all functions for empty query', () => {
    const registry = buildRegistry()
    const result = executeSearchTools(registry, {})
    expect(result.functions).toHaveLength(2)
  })

  it('returns all functions for undefined query', () => {
    const registry = buildRegistry()
    const result = executeSearchTools(registry, { query: undefined })
    expect(result.functions).toHaveLength(2)
  })

  it('filters by keyword', () => {
    const registry = buildRegistry()
    const result = executeSearchTools(registry, { query: 'coverage' })
    expect(result.functions[0].name).toBe('get_coverage_summary')
  })

  it('returns empty for no matches', () => {
    const registry = buildRegistry()
    const result = executeSearchTools(registry, { query: 'zzzzz' })
    expect(result.functions).toHaveLength(0)
  })

  it('includes declarations in results', () => {
    const registry = buildRegistry()
    const result = executeSearchTools(registry, { query: 'health' })
    expect(result.functions[0].declaration).toContain('get_project_health')
  })
})
