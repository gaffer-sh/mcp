import { afterEach, describe, expect, it, vi } from 'vitest'
import { GafferApiClient } from '../api-client.js'

const projects = { projects: [], pagination: { total: 0, limit: 50, offset: 0, hasMore: false } }

function headersOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  return fetchMock.mock.calls[0]![1].headers
}

describe('gafferApiClient transport options', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defaults to the global fetch and X-Gaffer-Source: mcp', async () => {
    const globalFetch = vi.fn(async () => Response.json(projects))
    vi.stubGlobal('fetch', globalFetch)

    await new GafferApiClient({ apiKey: 'gaf_test', baseUrl: 'https://app.gaffer.sh' }).listProjects({})

    expect(globalFetch).toHaveBeenCalledOnce()
    expect(headersOf(globalFetch)['X-Gaffer-Source']).toBe('mcp')
    expect(headersOf(globalFetch)['User-Agent']).toMatch(/^gaffer-mcp\/\d+\.\d+\.\d+$/)
  })

  it('sends every request through the given fetch with the given source', async () => {
    const globalFetch = vi.fn()
    vi.stubGlobal('fetch', globalFetch)
    const hostFetch = vi.fn(async () => Response.json(projects))

    const client = new GafferApiClient({ apiKey: 'gaf_test', baseUrl: 'https://app.gaffer.sh', fetch: hostFetch, source: 'mcp-hosted' })
    await client.listProjects({})

    expect(globalFetch).not.toHaveBeenCalled()
    expect(hostFetch.mock.calls[0]![0]).toBe('https://app.gaffer.sh/api/v1/user/projects')
    expect(headersOf(hostFetch)).toMatchObject({ 'X-API-Key': 'gaf_test', 'X-Gaffer-Source': 'mcp-hosted' })
  })
})
