import type { GafferApiClient } from '../api-client.js'
import type { UploadSessionDetailResponse, UploadSessionsResponse } from '../types.js'
import { z } from 'zod'

/**
 * Input schema for get_upload_status tool
 */
export const getUploadStatusInputSchema = {
  projectId: z
    .string()
    .describe('Project ID. Use list_projects to find project IDs.'),
  sessionId: z
    .string()
    .optional()
    .describe('Specific upload session ID. If provided, returns detailed status for that session. Otherwise, lists recent sessions.'),
  commitSha: z
    .string()
    .optional()
    .describe('Filter sessions by commit SHA. Useful for checking if results for a specific commit are ready.'),
  branch: z
    .string()
    .optional()
    .describe('Filter sessions by branch name.'),
}

/**
 * Output schema for get_upload_status tool
 */
export const getUploadStatusOutputSchema = {
  sessions: z.array(z.object({
    id: z.string(),
    processingStatus: z.string(),
    commitSha: z.string().nullable(),
    branch: z.string().nullable(),
    pendingFileCount: z.number(),
    failedFileCount: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })).optional(),
  session: z.object({
    id: z.string(),
    processingStatus: z.string(),
    commitSha: z.string().nullable(),
    branch: z.string().nullable(),
    createdAt: z.string(),
  }).optional(),
  testRuns: z.array(z.object({
    id: z.string(),
    framework: z.string().nullable(),
    summary: z.object({
      passed: z.number(),
      failed: z.number(),
      skipped: z.number(),
      total: z.number(),
    }),
    createdAt: z.string(),
  })).optional(),
  coverageReports: z.array(z.object({
    id: z.string(),
    format: z.string(),
    createdAt: z.string(),
  })).optional(),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }).optional(),
}

export interface GetUploadStatusInput {
  projectId: string
  sessionId?: string
  commitSha?: string
  branch?: string
}

export type GetUploadStatusOutput = UploadSessionsResponse | UploadSessionDetailResponse

/**
 * Execute get_upload_status tool
 */
export async function executeGetUploadStatus(
  client: GafferApiClient,
  input: GetUploadStatusInput,
): Promise<GetUploadStatusOutput> {
  if (input.sessionId) {
    return client.getUploadSessionDetail({
      projectId: input.projectId,
      sessionId: input.sessionId,
    })
  }

  return client.listUploadSessions({
    projectId: input.projectId,
    commitSha: input.commitSha,
    branch: input.branch,
  })
}

/**
 * Tool metadata
 */
export const getUploadStatusMetadata = {
  name: 'get_upload_status',
  title: 'Get Upload Status',
  description: `Check if CI results have been uploaded and processed.

Use this tool to answer "are my test results ready?" after pushing code.

Parameters:
- projectId (required): The project ID
- sessionId (optional): Specific upload session ID for detailed status
- commitSha (optional): Filter by commit SHA to find uploads for a specific commit
- branch (optional): Filter by branch name

Behavior:
- If sessionId is provided: returns detailed status with linked test runs and coverage reports
- Otherwise: returns a list of recent upload sessions (filtered by commitSha/branch if provided)

Processing statuses:
- "pending" — upload received, processing not started
- "processing" — files are being parsed
- "completed" — all files processed successfully, results are ready
- "error" — some files failed to process

Workflow:
1. After pushing code, call with commitSha to find the upload session
2. Check processingStatus — if "completed", results are ready
3. If "processing" or "pending", wait and check again
4. Once completed, use the linked testRunIds with get_test_run_details

Returns (list mode):
- sessions: Array of upload sessions with processing status
- pagination: Pagination info

Returns (detail mode):
- session: Upload session details
- testRuns: Linked test run summaries (id, framework, pass/fail counts)
- coverageReports: Linked coverage report summaries (id, format)`,
}
