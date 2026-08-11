import type { GafferApiClient } from '../../api-client.js'
import type { IngestPayload } from '../../types.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { executeUploadTestResults, uploadTestResultsInputSchema } from '../upload-test-results.js'

/**
 * Stand-in for GafferApiClient that records the payload it was handed.
 * Matches the injected-fake style used across src/codemode/__tests__.
 */
function makeClient(overrides: { isUserToken?: boolean } = {}) {
  const uploadTestResults = vi.fn().mockResolvedValue({ uploadSessionId: 'upl_abc123' })
  return {
    client: {
      isUserToken: () => overrides.isUserToken ?? false,
      uploadTestResults,
    } as unknown as GafferApiClient,
    uploadTestResults,
  }
}

function sentPayload(mock: ReturnType<typeof vi.fn>): IngestPayload {
  return mock.mock.calls[0]![0] as IngestPayload
}

const baseInput = {
  framework: 'vitest',
  tests: [
    { name: 'a passes', status: 'passed' as const, durationMs: 100 },
    { name: 'b fails', status: 'failed' as const, durationMs: 200, error: 'boom' },
    { name: 'c is skipped', status: 'skipped' as const, durationMs: 0 },
    { name: 'd is todo', status: 'todo' as const, durationMs: 0 },
  ],
}

describe('upload_test_results input schema', () => {
  const schema = z.object(uploadTestResultsInputSchema)

  it('accepts a minimal payload', () => {
    expect(schema.safeParse(baseInput).success).toBe(true)
  })

  it('rejects an empty test list', () => {
    // The ingest API requires at least one result; catching it here gives the
    // agent a usable message instead of a 400 from the server.
    const result = schema.safeParse({ framework: 'vitest', tests: [] })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown status', () => {
    const result = schema.safeParse({
      framework: 'vitest',
      tests: [{ name: 'x', status: 'errored' }],
    })
    expect(result.success).toBe(false)
  })

  it('requires a framework', () => {
    const result = schema.safeParse({ tests: baseInput.tests })
    expect(result.success).toBe(false)
  })

  it('treats durationMs as optional', () => {
    const result = schema.safeParse({
      framework: 'vitest',
      tests: [{ name: 'x', status: 'passed' }],
    })
    expect(result.success).toBe(true)
  })

  it.each(['finishedAt', 'startedAt'])('rejects a malformed %s', (field) => {
    // Without schema-level validation these reach the date arithmetic in
    // executeUploadTestResults and throw a RangeError, which reads to the agent
    // as an internal fault rather than bad input.
    const result = schema.safeParse({ ...baseInput, [field]: 'not-a-date' })
    expect(result.success).toBe(false)
  })

  it('accepts ISO 8601 with a non-UTC offset', () => {
    const result = schema.safeParse({ ...baseInput, finishedAt: '2026-01-01T00:00:00+02:00' })
    expect(result.success).toBe(true)
  })

  it('rejects a date without a time component', () => {
    const result = schema.safeParse({ ...baseInput, finishedAt: '2026-01-01' })
    expect(result.success).toBe(false)
  })
})

describe('upload_test_results summary derivation', () => {
  it('counts passed, failed and skipped, folding todo into skipped', () => {
    // todo maps to skipped downstream in the ingest pipeline, so the summary
    // has to agree with it or the counts contradict the stored results.
    const { client, uploadTestResults } = makeClient()

    return executeUploadTestResults(client, baseInput).then((output) => {
      expect(output.summary).toEqual({
        total: 4,
        passed: 1,
        failed: 1,
        skipped: 2,
        durationMs: 300,
      })
      expect(sentPayload(uploadTestResults).summary).toEqual(output.summary)
    })
  })

  it('defaults a missing durationMs to zero rather than NaN', async () => {
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, {
      framework: 'vitest',
      tests: [{ name: 'x', status: 'passed' }],
    })

    expect(sentPayload(uploadTestResults).summary.durationMs).toBe(0)
    expect(sentPayload(uploadTestResults).tests[0]!.durationMs).toBe(0)
  })
})

describe('upload_test_results derived fields', () => {
  it('generates a distinct runId per call', async () => {
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, baseInput)
    await executeUploadTestResults(client, baseInput)

    const first = uploadTestResults.mock.calls[0]![0] as IngestPayload
    const second = uploadTestResults.mock.calls[1]![0] as IngestPayload

    expect(first.runId).not.toBe(second.runId)
    expect(first.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('returns the same runId it sent, so the caller can correlate', async () => {
    const { client, uploadTestResults } = makeClient()

    const output = await executeUploadTestResults(client, baseInput)

    expect(output.runId).toBe(sentPayload(uploadTestResults).runId)
  })

  it('derives a start time by winding back the total duration from the end', async () => {
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, {
      ...baseInput,
      finishedAt: '2026-01-01T00:00:10.000Z',
    })

    const payload = sentPayload(uploadTestResults)
    expect(payload.finishedAt).toBe('2026-01-01T00:00:10.000Z')
    // 300ms of accumulated test time
    expect(payload.startedAt).toBe('2026-01-01T00:00:09.700Z')
  })

  it('honours explicit timestamps when both are supplied', async () => {
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, {
      ...baseInput,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:05:00.000Z',
    })

    const payload = sentPayload(uploadTestResults)
    expect(payload.startedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(payload.finishedAt).toBe('2026-01-01T00:05:00.000Z')
  })

  it('omits optional fields rather than sending undefined', async () => {
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, baseInput)

    const payload = sentPayload(uploadTestResults)
    expect('branch' in payload).toBe(false)
    expect('commitSha' in payload).toBe(false)
    expect('coverage' in payload).toBe(false)
    expect('filePath' in payload.tests[0]!).toBe(false)
  })

  it('passes through git and CI metadata when given', async () => {
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, {
      ...baseInput,
      branch: 'main',
      commitSha: 'abc123',
      ciProvider: 'github',
    })

    const payload = sentPayload(uploadTestResults)
    expect(payload.branch).toBe('main')
    expect(payload.commitSha).toBe('abc123')
    expect(payload.ciProvider).toBe('github')
  })

  it('defaults coverage.files to an empty array, which the API requires', async () => {
    const metrics = { covered: 1, total: 2 }
    const { client, uploadTestResults } = makeClient()

    await executeUploadTestResults(client, {
      ...baseInput,
      coverage: { format: 'lcov', lines: metrics, branches: metrics, functions: metrics },
    })

    expect(sentPayload(uploadTestResults).coverage?.files).toEqual([])
  })
})

describe('upload_test_results project scoping', () => {
  it('forwards projectId to the client', async () => {
    const { client, uploadTestResults } = makeClient({ isUserToken: true })

    await executeUploadTestResults(client, { ...baseInput, projectId: 'prj_1' })

    expect(uploadTestResults.mock.calls[0]![1]).toBe('prj_1')
  })

  it('surfaces client errors rather than swallowing them', async () => {
    const { client, uploadTestResults } = makeClient()
    uploadTestResults.mockRejectedValueOnce(new Error('Rate limit exceeded'))

    await expect(executeUploadTestResults(client, baseInput)).rejects.toThrow('Rate limit exceeded')
  })
})
