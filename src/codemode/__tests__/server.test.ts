import type { CodeRunner } from '../server.js'
import { describe, expect, it, vi } from 'vitest'
import { GafferApiClient } from '../../api-client.js'
import { createGafferMcpServer, handleStatelessHttpRequest } from '../server.js'

function rpc(method: string, params: Record<string, unknown> = {}): Request {
  return new Request('https://example.test/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
}

async function call(runCode: CodeRunner, method: string, params?: Record<string, unknown>, apiKey = 'gaf_test') {
  const client = new GafferApiClient({ apiKey, baseUrl: 'https://example.test' })
  const response = await handleStatelessHttpRequest(createGafferMcpServer(client, runCode), rpc(method, params))
  return (await response.json()).result
}

const unusedRunner: CodeRunner = async () => {
  throw new Error('not called')
}

describe('createGafferMcpServer over stateless HTTP', () => {
  it('lists the three code-mode tools for a user key', async () => {
    const result = await call(unusedRunner, 'tools/list')
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(['execute_code', 'search_tools', 'list_projects'])
  })

  it('omits list_projects for a project token', async () => {
    const result = await call(unusedRunner, 'tools/list', {}, `gfr_${'a'.repeat(64)}`)
    expect(result.tools.map((t: { name: string }) => t.name)).toEqual(['execute_code', 'search_tools'])
  })

  it('hands execute_code to the injected runner with the full registry namespace', async () => {
    const runCode = vi.fn<CodeRunner>(async () => ({ result: { ok: true }, logs: ['hi'], durationMs: 3 }))

    const result = await call(runCode, 'tools/call', { name: 'execute_code', arguments: { code: 'return 1' } })

    const [code, namespace] = runCode.mock.calls[0]!
    expect(code).toBe('return 1')
    expect(Object.keys(namespace)).toHaveLength(17)
    expect(JSON.parse(result.content[0].text)).toEqual({ result: { ok: true }, logs: ['hi'], durationMs: 3 })
  })

  it('reports a runner failure as a tool error with its captured logs', async () => {
    const runCode: CodeRunner = async () => {
      throw Object.assign(new Error('boom'), { logs: ['before'], durationMs: 5 })
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await call(runCode, 'tools/call', { name: 'execute_code', arguments: { code: 'x' } })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toBe('Error: boom\n\nCaptured logs:\nbefore\n\nDuration: 5ms')
  })

  it('answers a probe for an unsupported protocol revision with 400, which clients use to fall back', async () => {
    // Claude Code opens with `server/discover` at MCP-Protocol-Version 2026-07-28,
    // then retries with `initialize` once the server rejects that revision.
    const client = new GafferApiClient({ apiKey: 'gaf_test', baseUrl: 'https://example.test' })
    const probe = rpc('server/discover')
    probe.headers.set('mcp-protocol-version', '2026-07-28')

    const response = await handleStatelessHttpRequest(createGafferMcpServer(client, unusedRunner), probe)

    expect(response.status).toBe(400)
    expect((await response.json()).error.message).toMatch(/Unsupported protocol version: 2026-07-28/)
  })
})
