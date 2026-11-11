import type { GafferApiClient } from '../../api-client.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { executeGetTestHistory, getTestHistoryOutputSchema } from '../get-test-history.js'

function entry(status: 'passed' | 'failed', message: string | null) {
  return {
    testRunId: `run-${status}`,
    createdAt: '2026-11-02T00:00:00.000Z',
    test: { name: 'logs in', status, durationMs: 10, message },
  }
}

describe('get_test_history', () => {
  it('carries the failure message for failed runs and drops the null for passes', async () => {
    const client = {
      getTestHistory: vi.fn().mockResolvedValue({
        history: [entry('failed', 'expected 200, got 500'), entry('passed', null)],
        summary: { totalRuns: 2, passedRuns: 1, failedRuns: 1, passRate: 50, searchedBy: 'testName', searchValue: 'logs in' },
      }),
    } as unknown as GafferApiClient

    const result = await executeGetTestHistory(client, { projectId: 'p1', testName: 'logs in' })

    expect(result.history[0]!.message).toBe('expected 200, got 500')
    expect(result.history[1]!.message).toBeUndefined()
    expect(z.object(getTestHistoryOutputSchema).safeParse(result).success).toBe(true)
  })

  it('accepts fullName alone and forwards it', async () => {
    const getTestHistory = vi.fn().mockResolvedValue({
      history: [],
      summary: { totalRuns: 0, passedRuns: 0, failedRuns: 0, passRate: null, searchedBy: 'fullName', searchValue: 'Login > signs in [webkit]' },
    })
    const client = { getTestHistory } as unknown as GafferApiClient

    await executeGetTestHistory(client, { projectId: 'p1', fullName: 'Login > signs in [webkit]' })

    expect(getTestHistory).toHaveBeenCalledWith(expect.objectContaining({ fullName: 'Login > signs in [webkit]' }))
  })
})
