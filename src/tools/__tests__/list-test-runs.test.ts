import type { GafferApiClient } from '../../api-client.js'
import { describe, expect, it, vi } from 'vitest'
import { executeListTestRuns } from '../list-test-runs.js'

describe('list_test_runs', () => {
  it('forwards offset to the client', async () => {
    const getTestRuns = vi.fn().mockResolvedValue({
      testRuns: [],
      pagination: { limit: 20, offset: 40, total: 50, hasMore: false },
    })
    const client = { getTestRuns } as unknown as GafferApiClient

    await executeListTestRuns(client, { projectId: 'p1', offset: 40 })

    expect(getTestRuns).toHaveBeenCalledWith(expect.objectContaining({ offset: 40 }))
  })
})
