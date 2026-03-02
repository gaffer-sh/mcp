import { describe, expect, it } from 'vitest'
import { registerAllTools } from '../register-tools.js'
import { FunctionRegistry } from '../registry.js'

describe('registerAllTools', () => {
  it('registers the expected number of tools', () => {
    const registry = new FunctionRegistry()
    registerAllTools(registry)

    const all = registry.getAll()
    expect(all).toHaveLength(16)
  })

  it('registers key tool names', () => {
    const registry = new FunctionRegistry()
    registerAllTools(registry)

    const names = registry.getAll().map(e => e.name)
    expect(names).toContain('get_project_health')
    expect(names).toContain('get_flaky_tests')
    expect(names).toContain('get_coverage_summary')
    expect(names).toContain('list_test_runs')
    expect(names).toContain('search_failures')
  })

  it('every entry has non-empty metadata', () => {
    const registry = new FunctionRegistry()
    registerAllTools(registry)

    for (const entry of registry.getAll()) {
      expect(entry.name).toBeTruthy()
      expect(entry.description).toBeTruthy()
      expect(entry.category).toBeTruthy()
      expect(entry.keywords.length).toBeGreaterThan(0)
      expect(entry.execute).toBeTypeOf('function')
    }
  })

  it('assigns valid categories', () => {
    const registry = new FunctionRegistry()
    registerAllTools(registry)

    const validCategories = ['health', 'testing', 'coverage', 'reports', 'uploads']
    for (const entry of registry.getAll()) {
      expect(validCategories).toContain(entry.category)
    }
  })
})
