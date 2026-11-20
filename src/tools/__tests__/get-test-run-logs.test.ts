import type { GafferApiClient } from '../../api-client.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { executeGetTestRunLogs, getTestRunLogsInputSchema, getTestRunLogsOutputSchema } from '../get-test-run-logs.js'

function clientReturning(response: object) {
  const getTestRunLogs = vi.fn().mockResolvedValue(response)
  return { client: { getTestRunLogs } as unknown as GafferApiClient, getTestRunLogs }
}

const outputSchema = z.object(getTestRunLogsOutputSchema)
const inputSchema = z.object(getTestRunLogsInputSchema)

describe('get_test_run_logs', () => {
  it('lists the run\'s log files when file is omitted, without sending limit', async () => {
    const { client, getTestRunLogs } = clientReturning({ files: [{ file: 'backend.log', size: 42 }] })

    const result = await executeGetTestRunLogs(client, { testRunId: 'rpt-1', projectId: 'proj-1' })

    expect(getTestRunLogs).toHaveBeenCalledWith({ testRunId: 'rpt-1', projectId: 'proj-1', limit: undefined })
    expect(result).toEqual({ files: [{ file: 'backend.log', size: 42 }] })
    expect(outputSchema.safeParse(result).success).toBe(true)
  })

  it('returns files: [] for a run with no logs', async () => {
    const { client } = clientReturning({ files: [] })

    const result = await executeGetTestRunLogs(client, { testRunId: 'rpt-1' })

    expect(result).toEqual({ files: [] })
    expect(outputSchema.safeParse(result).success).toBe(true)
  })

  it('reads a page with a 200-line default limit and passes q and after through', async () => {
    const page = { file: 'backend.log', size: 300, lines: [{ offset: 120, text: 'ERROR boom' }], nextAfter: null, truncated: false }
    const { client, getTestRunLogs } = clientReturning(page)

    const result = await executeGetTestRunLogs(client, { testRunId: 'rpt-1', file: 'backend.log', q: 'error', after: 120 })

    expect(getTestRunLogs).toHaveBeenCalledWith({ testRunId: 'rpt-1', file: 'backend.log', q: 'error', after: 120, limit: 200 })
    expect(result).toEqual(page)
    expect(outputSchema.safeParse(result).success).toBe(true)
  })

  it('rejects an empty file instead of falling back to list mode', () => {
    expect(inputSchema.safeParse({ testRunId: 'rpt-1', file: '' }).success).toBe(false)
    expect(inputSchema.safeParse({ testRunId: 'rpt-1' }).success).toBe(true)
  })

  it('keeps an explicit limit', async () => {
    const { client, getTestRunLogs } = clientReturning({ file: 'a.log', size: 0, lines: [], nextAfter: null, truncated: false })

    await executeGetTestRunLogs(client, { testRunId: 'rpt-1', file: 'a.log', limit: 1000 })

    expect(getTestRunLogs).toHaveBeenCalledWith(expect.objectContaining({ limit: 1000 }))
  })
})
