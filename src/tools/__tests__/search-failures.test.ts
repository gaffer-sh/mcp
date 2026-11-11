import type { GafferApiClient } from '../../api-client.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { executeSearchFailures, searchFailuresOutputSchema } from '../search-failures.js'

const base = { matches: [], total: 0, truncated: false, query: null }

describe('search_failures', () => {
  it('forwards offset and returns the API pagination', async () => {
    const pagination = { limit: 20, offset: 20, hasMore: true }
    const searchFailures = vi.fn().mockResolvedValue({ ...base, pagination })
    const client = { searchFailures } as unknown as GafferApiClient

    const result = await executeSearchFailures(client, { projectId: 'p1', offset: 20 })

    expect(searchFailures).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }))
    expect(result.pagination).toEqual(pagination)
    expect(z.object(searchFailuresOutputSchema).safeParse(result).success).toBe(true)
  })

  it('accepts a response from an API without pagination', () => {
    expect(z.object(searchFailuresOutputSchema).safeParse(base).success).toBe(true)
  })
})
