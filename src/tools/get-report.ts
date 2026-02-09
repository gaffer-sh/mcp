import type { GafferApiClient } from '../api-client.js'
import type { ReportFile, ReportResponse } from '../types.js'
import { z } from 'zod'

/**
 * Input schema for get_report tool
 */
export const getReportInputSchema = {
  testRunId: z
    .string()
    .describe('The test run ID to get report files for. Use list_test_runs to find test run IDs.'),
}

/**
 * Output schema for get_report tool
 */
export const getReportOutputSchema = {
  testRunId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  resultSchema: z.string().optional(),
  files: z.array(z.object({
    filename: z.string(),
    size: z.number(),
    contentType: z.string(),
    downloadUrl: z.string(),
  })),
  urlExpiresInSeconds: z.number().optional(),
}

export interface GetReportInput {
  testRunId: string
}

// Re-export types from types.ts for convenience
export type { ReportFile, ReportResponse }

// Output type matches ReportResponse
export type GetReportOutput = ReportResponse

/**
 * Execute get_report tool
 */
export async function executeGetReport(
  client: GafferApiClient,
  input: GetReportInput,
): Promise<GetReportOutput> {
  const response = await client.getReport(input.testRunId)

  return {
    testRunId: response.testRunId,
    projectId: response.projectId,
    projectName: response.projectName,
    resultSchema: response.resultSchema,
    files: response.files.map(file => ({
      filename: file.filename,
      size: file.size,
      contentType: file.contentType,
      downloadUrl: file.downloadUrl,
    })),
    urlExpiresInSeconds: response.urlExpiresInSeconds,
  }
}

/**
 * Tool metadata
 */
export const getReportMetadata = {
  name: 'get_report',
  title: 'Get Report Files',
  description: `Get URLs for report files uploaded with a test run.

IMPORTANT: This tool returns download URLs, not file content. You must fetch the URLs separately.

Returns for each file:
- filename: The file name (e.g., "report.html", "results.json", "junit.xml")
- size: File size in bytes
- contentType: MIME type (e.g., "text/html", "application/json", "application/xml")
- downloadUrl: Presigned URL to download the file (valid for ~5 minutes)

How to use the returned URLs:

1. **JSON files** (results.json, coverage.json):
   Use WebFetch with the downloadUrl to retrieve and parse the JSON content.
   Example: WebFetch(url=downloadUrl, prompt="Extract test results from this JSON")

2. **XML files** (junit.xml, xunit.xml):
   Use WebFetch with the downloadUrl to retrieve and parse the XML content.
   Example: WebFetch(url=downloadUrl, prompt="Parse the test results from this JUnit XML")

3. **HTML reports** (Playwright, pytest-html, Vitest):
   These are typically bundled React/JavaScript applications that require a browser.
   They cannot be meaningfully parsed by WebFetch.
   For programmatic analysis, use get_test_run_details instead.

Recommendations:
- For analyzing test results programmatically: Use get_test_run_details (returns parsed test data)
- For JSON/XML files: Use this tool + WebFetch on the downloadUrl
- For HTML reports: Direct users to view in browser, or use get_test_run_details

Use cases:
- "What files are in this test run?" (list available reports)
- "Get the coverage data from this run" (then WebFetch the JSON URL)
- "Parse the JUnit XML results" (then WebFetch the XML URL)`,
}
