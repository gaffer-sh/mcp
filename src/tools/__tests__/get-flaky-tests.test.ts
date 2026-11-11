import type { GafferApiClient } from '../../api-client.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { executeGetFlakyTests, getFlakyTestsOutputSchema } from '../get-flaky-tests.js'

function flaky(fullName?: string) {
  return { name: 'signs in', ...(fullName && { fullName }), flipRate: 0.4, flipCount: 4, totalRuns: 10, lastSeen: '2026-11-02T00:00:00.000Z', flakinessScore: 0.5 }
}

async function run(flakyTests: ReturnType<typeof flaky>[]) {
  const client = {
    getFlakyTests: vi.fn().mockResolvedValue({ flakyTests, summary: { threshold: 0.1, totalFlaky: flakyTests.length, period: 30 } }),
  } as unknown as GafferApiClient
  return executeGetFlakyTests(client, { projectId: 'p1' })
}

describe('get_flaky_tests', () => {
  it('carries fullName so entries one per Playwright project stay distinguishable', async () => {
    const result = await run([flaky('Login > signs in [chromium]'), flaky('Login > signs in [webkit]')])

    expect(result.flakyTests.map(t => t.fullName)).toEqual(['Login > signs in [chromium]', 'Login > signs in [webkit]'])
    expect(z.object(getFlakyTestsOutputSchema).safeParse(result).success).toBe(true)
  })

  it('still validates against an older API that sends no fullName', async () => {
    const result = await run([flaky()])

    expect(z.object(getFlakyTestsOutputSchema).safeParse(result).success).toBe(true)
  })
})
