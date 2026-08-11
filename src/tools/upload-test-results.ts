import type { GafferApiClient } from '../api-client.js'
import type { IngestPayload, IngestTestResult } from '../types.js'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const coverageMetricsSchema = z.object({
  covered: z.number().int().min(0),
  total: z.number().int().min(0),
})

/**
 * Input schema for upload_test_results tool
 */
export const uploadTestResultsInputSchema = {
  projectId: z
    .string()
    .optional()
    .describe('Project ID. Required for user API keys (gaf_). Not needed for project tokens — omit and it resolves automatically.'),
  framework: z
    .string()
    .min(1)
    .max(50)
    .describe('Test framework that produced these results (e.g. "vitest", "pytest", "playwright")'),
  tests: z
    .array(z.object({
      name: z.string().min(1).describe('Test name, ideally including its suite path'),
      status: z.enum(['passed', 'failed', 'skipped', 'todo']),
      durationMs: z.number().min(0).optional().describe('Test duration in milliseconds (default: 0)'),
      filePath: z.string().optional().describe('Source file the test lives in'),
      error: z.string().max(10_000).optional().describe('Failure message. Only meaningful for failed tests.'),
      retryCount: z.number().int().min(0).optional(),
      flaky: z.boolean().optional().describe('True if the test passed only after a retry'),
    }))
    .min(1)
    .max(50_000)
    .describe('The test results to upload. At least one is required.'),
  branch: z.string().max(256).optional().describe('Git branch these results came from'),
  commitSha: z.string().max(256).optional().describe('Git commit SHA these results came from'),
  ciProvider: z.string().max(100).optional().describe('CI provider name, when running in CI'),
  // Validated here, not just server-side: a malformed finishedAt would reach
  // the date arithmetic below and throw a RangeError out of the tool, which
  // reads to the agent as an internal fault rather than bad input.
  // Mirrors ingestPayloadSchema's `datetime({ offset: true })` on the server.
  startedAt: z
    .string()
    .datetime({ offset: true, message: 'startedAt must be an ISO 8601 timestamp' })
    .optional()
    .describe('ISO 8601 start time of the run. Defaults to now minus the total test duration.'),
  finishedAt: z
    .string()
    .datetime({ offset: true, message: 'finishedAt must be an ISO 8601 timestamp' })
    .optional()
    .describe('ISO 8601 end time of the run. Defaults to now.'),
  coverage: z
    .object({
      format: z.string().min(1).max(50).describe('Coverage format the numbers came from (e.g. "lcov")'),
      lines: coverageMetricsSchema,
      branches: coverageMetricsSchema,
      functions: coverageMetricsSchema,
      files: z
        .array(z.object({
          path: z.string().min(1),
          lines: coverageMetricsSchema,
          branches: coverageMetricsSchema,
          functions: coverageMetricsSchema,
        }))
        .max(50_000)
        .optional(),
    })
    .optional()
    .describe('Optional coverage totals for this run'),
}

/**
 * Output schema for upload_test_results tool
 */
export const uploadTestResultsOutputSchema = {
  uploadSessionId: z.string(),
  runId: z.string(),
  status: z.string(),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    durationMs: z.number(),
  }),
}

export interface UploadTestResultsInput {
  projectId?: string
  framework: string
  tests: Array<{
    name: string
    status: 'passed' | 'failed' | 'skipped' | 'todo'
    durationMs?: number
    filePath?: string
    error?: string
    retryCount?: number
    flaky?: boolean
  }>
  branch?: string
  commitSha?: string
  ciProvider?: string
  startedAt?: string
  finishedAt?: string
  coverage?: {
    format: string
    lines: { covered: number, total: number }
    branches: { covered: number, total: number }
    functions: { covered: number, total: number }
    files?: Array<{
      path: string
      lines: { covered: number, total: number }
      branches: { covered: number, total: number }
      functions: { covered: number, total: number }
    }>
  }
}

export interface UploadTestResultsOutput {
  uploadSessionId: string
  runId: string
  status: string
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    durationMs: number
  }
}

/**
 * Derive the run summary from the test list.
 *
 * The ingest API requires a summary, but making the caller compute one invites
 * drift between the counts and the results they describe. `todo` counts as
 * skipped, matching how the ingest pipeline maps it downstream.
 */
function summarize(tests: UploadTestResultsInput['tests']) {
  let passed = 0
  let failed = 0
  let skipped = 0
  let durationMs = 0

  for (const test of tests) {
    durationMs += test.durationMs ?? 0
    if (test.status === 'passed')
      passed++
    else if (test.status === 'failed')
      failed++
    else
      skipped++
  }

  return { total: tests.length, passed, failed, skipped, durationMs }
}

/**
 * Execute upload_test_results tool
 */
export async function executeUploadTestResults(
  client: GafferApiClient,
  input: UploadTestResultsInput,
): Promise<UploadTestResultsOutput> {
  const summary = summarize(input.tests)

  // The API wants a wall-clock window. An agent forwarding results parsed out of
  // CI logs usually has neither timestamp, so fall back to a window ending now
  // and running back over the accumulated test time.
  const finishedAt = input.finishedAt ?? new Date().toISOString()
  const startedAt = input.startedAt
    ?? new Date(new Date(finishedAt).getTime() - summary.durationMs).toISOString()

  const tests: IngestTestResult[] = input.tests.map(test => ({
    name: test.name,
    status: test.status,
    durationMs: test.durationMs ?? 0,
    ...(test.filePath !== undefined && { filePath: test.filePath }),
    ...(test.error !== undefined && { error: test.error }),
    ...(test.retryCount !== undefined && { retryCount: test.retryCount }),
    ...(test.flaky !== undefined && { flaky: test.flaky }),
  }))

  const payload: IngestPayload = {
    runId: randomUUID(),
    framework: input.framework,
    ...(input.branch !== undefined && { branch: input.branch }),
    ...(input.commitSha !== undefined && { commitSha: input.commitSha }),
    ...(input.ciProvider !== undefined && { ciProvider: input.ciProvider }),
    startedAt,
    finishedAt,
    summary,
    tests,
    ...(input.coverage !== undefined && {
      coverage: { ...input.coverage, files: input.coverage.files ?? [] },
    }),
  }

  const response = await client.uploadTestResults(payload, input.projectId)

  return {
    uploadSessionId: response.uploadSessionId,
    runId: payload.runId,
    status: 'accepted',
    summary,
  }
}

/**
 * Tool metadata
 */
export const uploadTestResultsMetadata = {
  name: 'upload_test_results',
  title: 'Upload Test Results',
  description: `Upload structured test results to Gaffer.

Use this when you have test results in hand — parsed from CI output, a test
runner's JSON report, or your own run — and no Gaffer CLI is available to upload
them. Once uploaded, the results feed history, flaky detection, and health
scores, so the read functions can see them on subsequent calls.

Provide the tests; runId, the run timestamps and the pass/fail summary are all
derived for you. Pass startedAt/finishedAt only if you know the real wall-clock
window.

Returns:
- uploadSessionId: Track processing with get_upload_status
- runId: The generated identifier for this run
- status: Always "accepted" — processing happens asynchronously, so results take
  a few seconds to appear in queries
- summary: The derived pass/fail/skip counts

This is a write. It is rate-limited per project and recorded in the project's
audit log. Uploading is not idempotent: calling it twice creates two runs, so do
not retry a call that may have already succeeded — check get_upload_status
instead.`,
}
