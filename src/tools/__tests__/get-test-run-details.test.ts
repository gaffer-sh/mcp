import type { GafferApiClient } from '../../api-client.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { executeGetTestRunDetails, getTestRunDetailsOutputSchema } from '../get-test-run-details.js'

const errorStack = 'AssertionError: boom\n    at auth.spec.ts:25:5'
const failedTest = {
  name: 'rejects',
  fullName: 'rejects',
  status: 'failed',
  durationMs: 200,
  filePath: null,
  error: 'boom',
  errorStack,
}

function clientReturning(summary: object, test: object) {
  return {
    getTestRunDetails: vi.fn().mockResolvedValue({
      testRunId: 'rpt-1',
      commitSha: null,
      branch: null,
      framework: 'junit',
      createdAt: '2026-11-02T00:00:00.000Z',
      summary,
      tests: [test],
      pagination: { total: 1, limit: 100, offset: 0, hasMore: false },
    }),
  } as unknown as GafferApiClient
}

const outputSchema = z.object(getTestRunDetailsOutputSchema)

describe('get_test_run_details', () => {
  it('passes the API\'s errorStack through to the agent', async () => {
    const client = clientReturning({ passed: 0, failed: 1, skipped: 0, total: 1 }, failedTest)

    const result = await executeGetTestRunDetails(client, { testRunId: 'rpt-1' })

    expect(result.tests[0]!.errorStack).toBe(errorStack)
    // An API deployment without suite/line/retryAttempt/flaky must still validate.
    expect(outputSchema.safeParse(result).success).toBe(true)
  })

  it('passes suite, line, retryAttempt and summary.flaky through', async () => {
    const client = clientReturning(
      { passed: 0, failed: 1, skipped: 0, flaky: 1, total: 1 },
      { ...failedTest, suite: 'auth', line: 25, retryAttempt: 2 },
    )

    const result = await executeGetTestRunDetails(client, { testRunId: 'rpt-1' })

    expect(result.summary.flaky).toBe(1)
    expect(result.tests[0]).toMatchObject({ suite: 'auth', line: 25, retryAttempt: 2 })
    expect(outputSchema.safeParse(result).success).toBe(true)
  })
})
