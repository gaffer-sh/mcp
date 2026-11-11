import { afterEach, describe, expect, it, vi } from 'vitest'
import { GafferApiClient } from '../api-client.js'

/** Stubs fetch and returns the query string of the one request the call makes. */
async function sentParams(call: (client: GafferApiClient) => Promise<unknown>): Promise<URLSearchParams> {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  await call(new GafferApiClient({ apiKey: 'gaf_test', baseUrl: 'https://example.test' }))
  return new URL(fetchMock.mock.calls[0]![0] as string).searchParams
}

describe('gafferApiClient offset passthrough', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('searchFailures forwards offset', async () => {
    const params = await sentParams(c => c.searchFailures({ projectId: 'p1', offset: 40 }))
    expect(params.get('offset')).toBe('40')
  })

  it('searchFailures omits offset 0, which is the API default', async () => {
    const params = await sentParams(c => c.searchFailures({ projectId: 'p1', offset: 0 }))
    expect(params.has('offset')).toBe(false)
  })

  it('getTestRuns forwards offset', async () => {
    const params = await sentParams(c => c.getTestRuns({ projectId: 'p1', offset: 20 }))
    expect(params.get('offset')).toBe('20')
  })

  it('getTestHistory forwards fullName, which is valid on its own', async () => {
    const params = await sentParams(c => c.getTestHistory({ projectId: 'p1', fullName: 'Login > signs in [webkit]' }))
    expect(params.get('fullName')).toBe('Login > signs in [webkit]')
    expect(params.has('testName')).toBe(false)
  })
})
