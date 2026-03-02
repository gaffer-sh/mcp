import type { FunctionEntry } from '../types.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { FunctionRegistry } from '../registry.js'

function makeEntry(overrides: Partial<FunctionEntry> = {}): FunctionEntry {
  return {
    name: 'test_fn',
    description: 'A test function',
    category: 'testing',
    keywords: ['test', 'example'],
    inputSchema: {
      projectId: z.string().optional(),
    },
    execute: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

describe('functionRegistry', () => {
  describe('register and get', () => {
    it('registers and retrieves a function', () => {
      const registry = new FunctionRegistry()
      const entry = makeEntry()
      registry.register(entry)

      expect(registry.get('test_fn')).toBe(entry)
    })

    it('returns undefined for unregistered function', () => {
      const registry = new FunctionRegistry()
      expect(registry.get('nope')).toBeUndefined()
    })

    it('getAll returns all registered entries', () => {
      const registry = new FunctionRegistry()
      registry.register(makeEntry({ name: 'fn_a' }))
      registry.register(makeEntry({ name: 'fn_b' }))

      expect(registry.getAll()).toHaveLength(2)
    })
  })

  describe('buildNamespace', () => {
    it('creates namespace with callable functions', async () => {
      const registry = new FunctionRegistry()
      const executeFn = vi.fn().mockResolvedValue({ score: 95 })
      registry.register(makeEntry({ execute: executeFn }))

      const mockClient = {} as any
      const ns = registry.buildNamespace(mockClient)

      expect(ns.test_fn).toBeDefined()
      const result = await ns.test_fn({ projectId: 'proj_123' })
      expect(result).toEqual({ score: 95 })
      expect(executeFn).toHaveBeenCalledWith(mockClient, { projectId: 'proj_123' })
    })

    it('validates input against schema', async () => {
      const registry = new FunctionRegistry()
      registry.register(makeEntry({
        inputSchema: {
          days: z.number().int().min(1),
        },
      }))

      const ns = registry.buildNamespace({} as any)
      await expect(ns.test_fn({ days: 'not-a-number' })).rejects.toThrow('Invalid input for test_fn: days: Expected number, received string')
    })

    it('works with empty input', async () => {
      const registry = new FunctionRegistry()
      const executeFn = vi.fn().mockResolvedValue({ ok: true })
      registry.register(makeEntry({
        inputSchema: { projectId: z.string().optional() },
        execute: executeFn,
      }))

      const ns = registry.buildNamespace({} as any)
      await ns.test_fn()
      expect(executeFn).toHaveBeenCalledWith({}, {})
    })
  })

  describe('generateAllDeclarations', () => {
    it('generates declarations for all functions', () => {
      const registry = new FunctionRegistry()
      registry.register(makeEntry({ name: 'get_health', description: 'Get health' }))
      registry.register(makeEntry({ name: 'get_flaky', description: 'Get flaky tests' }))

      const decls = registry.generateAllDeclarations()
      expect(decls).toContain('get_health')
      expect(decls).toContain('get_flaky')
      expect(decls).toContain('Get health')
      expect(decls).toContain('Get flaky tests')
    })
  })

  describe('search', () => {
    function buildRegistry(): FunctionRegistry {
      const registry = new FunctionRegistry()
      registry.register(makeEntry({
        name: 'get_project_health',
        description: 'Get health metrics',
        category: 'health',
        keywords: ['health', 'score', 'pass rate'],
      }))
      registry.register(makeEntry({
        name: 'get_flaky_tests',
        description: 'Get flaky tests',
        category: 'testing',
        keywords: ['flaky', 'flip', 'inconsistent'],
      }))
      registry.register(makeEntry({
        name: 'get_coverage_summary',
        description: 'Get coverage summary',
        category: 'coverage',
        keywords: ['coverage', 'lines', 'branches'],
      }))
      return registry
    }

    it('returns all functions for empty query', () => {
      const registry = buildRegistry()
      const results = registry.search('')
      expect(results).toHaveLength(3)
    })

    it('scores name matches highest', () => {
      const registry = buildRegistry()
      const results = registry.search('flaky')
      expect(results[0].name).toBe('get_flaky_tests')
    })

    it('matches by category', () => {
      const registry = buildRegistry()
      const results = registry.search('coverage')
      expect(results[0].name).toBe('get_coverage_summary')
    })

    it('matches by keyword', () => {
      const registry = buildRegistry()
      const results = registry.search('flip')
      expect(results[0].name).toBe('get_flaky_tests')
    })

    it('matches by description', () => {
      const registry = buildRegistry()
      const results = registry.search('metrics')
      expect(results[0].name).toBe('get_project_health')
    })

    it('returns empty for no matches', () => {
      const registry = buildRegistry()
      const results = registry.search('zzzznothing')
      expect(results).toHaveLength(0)
    })

    it('includes declarations in results', () => {
      const registry = buildRegistry()
      const results = registry.search('health')
      expect(results[0].declaration).toContain('get_project_health')
    })
  })

  describe('listAll', () => {
    it('returns all with declarations', () => {
      const registry = new FunctionRegistry()
      registry.register(makeEntry({ name: 'fn_a' }))
      registry.register(makeEntry({ name: 'fn_b' }))

      const all = registry.listAll()
      expect(all).toHaveLength(2)
      expect(all[0].declaration).toContain('fn_a')
    })
  })
})
