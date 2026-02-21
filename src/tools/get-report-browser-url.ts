import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for get_report_browser_url tool
 */
export const getReportBrowserUrlInputSchema = {
  projectId: z
    .string()
    .describe('Project ID. Use list_projects to find project IDs.'),
  testRunId: z
    .string()
    .describe('The test run ID to get the report URL for. Use list_test_runs to find test run IDs.'),
  filename: z
    .string()
    .optional()
    .describe('Specific file to open (default: index.html or first HTML file)'),
}

/**
 * Output schema for get_report_browser_url tool
 */
export const getReportBrowserUrlOutputSchema = {
  url: z.string(),
  filename: z.string(),
  testRunId: z.string(),
  expiresAt: z.string(),
  expiresInSeconds: z.number(),
}

export interface GetReportBrowserUrlInput {
  projectId: string
  testRunId: string
  filename?: string
}

export interface GetReportBrowserUrlOutput {
  url: string
  filename: string
  testRunId: string
  expiresAt: string
  expiresInSeconds: number
}

/**
 * Execute get_report_browser_url tool
 */
export async function executeGetReportBrowserUrl(
  client: GafferApiClient,
  input: GetReportBrowserUrlInput,
): Promise<GetReportBrowserUrlOutput> {
  const response = await client.getReportBrowserUrl({
    projectId: input.projectId,
    testRunId: input.testRunId,
    filename: input.filename,
  })

  return {
    url: response.url,
    filename: response.filename,
    testRunId: response.testRunId,
    expiresAt: response.expiresAt,
    expiresInSeconds: response.expiresInSeconds,
  }
}

/**
 * Tool metadata
 */
export const getReportBrowserUrlMetadata = {
  name: 'get_report_browser_url',
  title: 'Get Report Browser URL',
  description: `Get a browser-navigable URL for viewing a test report (Playwright, Vitest, etc.).

Returns a signed URL that can be opened directly in a browser without requiring
the user to log in. The URL expires after 30 minutes for security.

Parameters:
- projectId: The project the test run belongs to (required)
- testRunId: The test run to view (required)
- filename: Specific file to open (optional, defaults to index.html)

Returns:
- url: Browser-navigable URL with signed token
- filename: The file being accessed
- expiresAt: ISO timestamp when the URL expires
- expiresInSeconds: Time until expiration

The returned URL can be shared with users who need to view the report.
Note: URLs expire after 30 minutes for security.`,
}
