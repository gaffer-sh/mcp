import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { generateDeclaration, zodToTs } from '../type-gen.js'

describe('zodToTs', () => {
  it('converts string', () => {
    expect(zodToTs(z.string())).toBe('string')
  })

  it('converts number', () => {
    expect(zodToTs(z.number())).toBe('number')
  })

  it('converts boolean', () => {
    expect(zodToTs(z.boolean())).toBe('boolean')
  })

  it('converts enum', () => {
    expect(zodToTs(z.enum(['up', 'down', 'stable']))).toBe('\'up\' | \'down\' | \'stable\'')
  })

  it('converts literal string', () => {
    expect(zodToTs(z.literal('foo'))).toBe('\'foo\'')
  })

  it('converts literal number', () => {
    expect(zodToTs(z.literal(42))).toBe('42')
  })

  it('converts optional', () => {
    expect(zodToTs(z.string().optional())).toBe('string | undefined')
  })

  it('converts nullable', () => {
    expect(zodToTs(z.string().nullable())).toBe('string | null')
  })

  it('converts array of strings', () => {
    expect(zodToTs(z.array(z.string()))).toBe('string[]')
  })

  it('converts array of union types with parens', () => {
    expect(zodToTs(z.array(z.string().nullable()))).toBe('(string | null)[]')
  })

  it('converts object', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
    })
    expect(zodToTs(schema)).toBe('{ name: string; age: number }')
  })

  it('converts object with optional fields', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    })
    expect(zodToTs(schema)).toBe('{ name: string; age?: number }')
  })

  it('converts nested object', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
      }),
    })
    expect(zodToTs(schema)).toBe('{ user: { name: string } }')
  })

  it('converts record', () => {
    expect(zodToTs(z.record(z.string()))).toBe('Record<string, string>')
  })

  it('converts union', () => {
    expect(zodToTs(z.union([z.string(), z.number()]))).toBe('string | number')
  })

  it('converts default (unwraps)', () => {
    expect(zodToTs(z.string().default('hello'))).toBe('string')
  })

  it('converts number with constraints (stays number)', () => {
    expect(zodToTs(z.number().int().min(1).max(365))).toBe('number')
  })

  it('returns unknown for unsupported types', () => {
    expect(zodToTs(z.any())).toBe('unknown')
  })
})

describe('generateDeclaration', () => {
  it('generates declaration with no params', () => {
    const result = generateDeclaration('do_thing', 'Does a thing', {})
    expect(result).toBe('/** Does a thing */\ndo_thing(): Promise<any>')
  })

  it('generates declaration with params', () => {
    const result = generateDeclaration('get_health', 'Get health', {
      projectId: z.string().optional(),
      days: z.number(),
    })
    expect(result).toContain('get_health(input: {')
    expect(result).toContain('projectId?: string')
    expect(result).toContain('days: number')
    expect(result).toContain('}): Promise<any>')
  })

  it('includes description as JSDoc comment', () => {
    const result = generateDeclaration('foo', 'A useful function', {})
    expect(result).toContain('/** A useful function */')
  })
})
