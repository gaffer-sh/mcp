import { describe, expect, it, vi } from 'vitest'
import { executeCode, validateCode } from '../executor.js'

describe('validateCode', () => {
  it('returns null for safe code', () => {
    expect(validateCode('const x = await codemode.get_health({}); return x;')).toBeNull()
  })

  it.each([
    ['globalThis', 'globalThis.fetch'],
    ['process', 'process.env.SECRET'],
    ['require(', 'require(\'fs\')'],
    ['import ', 'import fs from \'fs\''],
    ['import(', 'import(\'fs\')'],
    ['eval(', 'eval(\'alert(1)\')'],
    ['Function(', 'Function(\'return 1\')()'],
    ['new Function', 'new Function(\'return 1\')()'],
    ['Buffer', 'Buffer.from("x")'],
    ['__dirname', 'console.log(__dirname)'],
    ['__filename', 'console.log(__filename)'],
    ['.constructor', '(async()=>{}).constructor'],
    ['Reflect', 'Reflect.ownKeys({})'],
  ])('blocks %s', (pattern, code) => {
    expect(validateCode(code)).toBe(pattern)
  })
})

describe('executeCode', () => {
  it('returns the result of the code', async () => {
    const result = await executeCode('return 42', {})
    expect(result.result).toBe(42)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('captures console.log output', async () => {
    const result = await executeCode('console.log("hello"); return 1', {})
    expect(result.logs).toEqual(['hello'])
  })

  it('captures console.warn with prefix', async () => {
    const result = await executeCode('console.warn("careful"); return 1', {})
    expect(result.logs).toEqual(['[warn] careful'])
  })

  it('captures console.error with prefix', async () => {
    const result = await executeCode('console.error("bad"); return 1', {})
    expect(result.logs).toEqual(['[error] bad'])
  })

  it('captures object arguments as JSON', async () => {
    const result = await executeCode('console.log({ a: 1 }); return 1', {})
    expect(result.logs).toEqual(['{"a":1}'])
  })

  it('calls namespace functions', async () => {
    const mockFn = vi.fn().mockResolvedValue({ score: 95 })
    const result = await executeCode(
      'const h = await codemode.get_health(); return h;',
      { get_health: mockFn },
    )
    expect(result.result).toEqual({ score: 95 })
    expect(mockFn).toHaveBeenCalled()
  })

  it('passes arguments to namespace functions', async () => {
    const mockFn = vi.fn().mockResolvedValue({ ok: true })
    await executeCode(
      'return await codemode.do_thing({ id: "proj_123" })',
      { do_thing: mockFn },
    )
    expect(mockFn).toHaveBeenCalledWith({ id: 'proj_123' })
  })

  it('throws on blocked patterns', async () => {
    await expect(executeCode('process.exit(1)', {}))
      .rejects
      .toThrow('Blocked pattern detected: "process"')
  })

  it('throws on syntax errors', async () => {
    await expect(executeCode('const x = {{{', {}))
      .rejects
      .toThrow()
  })

  it('enforces API call limit', async () => {
    const mockFn = vi.fn().mockResolvedValue({ ok: true })
    const code = `
      for (let i = 0; i < 25; i++) {
        await codemode.fn();
      }
    `
    await expect(executeCode(code, { fn: mockFn }))
      .rejects
      .toThrow('API call limit exceeded')
    // Should have been called exactly 20 times before the limit was hit
    expect(mockFn).toHaveBeenCalledTimes(20)
  })

  it('attaches logs to errors', async () => {
    try {
      await executeCode('console.log("debug info"); throw new Error("boom")', {})
      expect.fail('should have thrown')
    }
    catch (error: any) {
      expect(error.message).toBe('boom')
      expect(error.logs).toEqual(['debug info'])
      expect(error.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles undefined return', async () => {
    const result = await executeCode('const x = 1', {})
    expect(result.result).toBeUndefined()
  })

  it('handles circular references in console.log gracefully', async () => {
    const result = await executeCode(
      'const a = {}; a.self = a; console.log(a); return 1',
      {},
    )
    expect(result.logs).toHaveLength(1)
    expect(result.logs[0]).toBe('[object Object]')
    expect(result.result).toBe(1)
  })

  it('preserves error cause for debugging', async () => {
    try {
      await executeCode('throw new TypeError("bad type")', {})
      expect.fail('should have thrown')
    }
    catch (error: any) {
      expect(error.message).toBe('bad type')
      expect(error.cause).toBeInstanceOf(TypeError)
    }
  })

  it('handles multiple console calls', async () => {
    const result = await executeCode(
      'console.log("a"); console.warn("b"); console.error("c"); return "done"',
      {},
    )
    expect(result.logs).toEqual(['a', '[warn] b', '[error] c'])
    expect(result.result).toBe('done')
  })
})
