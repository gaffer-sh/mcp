# @gaffer-sh/mcp

MCP (Model Context Protocol) server for [Gaffer](https://gaffer.sh) - give your AI assistant memory of your tests.

## What is this?

This MCP server connects AI coding assistants like Claude Code and Cursor to your Gaffer test history and coverage data. It allows AI to:

- Check your project's test health (pass rate, flaky tests, trends)
- Look up the history of specific tests to understand stability
- Get context about test failures when debugging
- Analyze code coverage and identify untested areas
- Browse all your projects (with user API Keys)
- Access test report files (HTML reports, coverage, etc.)

## Prerequisites

1. A [Gaffer](https://gaffer.sh) account with test results uploaded
2. An API Key from Account Settings > API Keys

## Setup

### Claude Code (CLI)

The easiest way to add the Gaffer MCP server is via the Claude Code CLI:

```bash
claude mcp add gaffer -e GAFFER_API_KEY=gaf_your_api_key_here -- npx -y @gaffer-sh/mcp
```

### Claude Code (Manual)

Alternatively, add to your Claude Code settings (`~/.claude.json` or project `.claude/settings.json`):

```json
{
  "mcpServers": {
    "gaffer": {
      "command": "npx",
      "args": ["-y", "@gaffer-sh/mcp"],
      "env": {
        "GAFFER_API_KEY": "gaf_your_api_key_here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "gaffer": {
      "command": "npx",
      "args": ["-y", "@gaffer-sh/mcp"],
      "env": {
        "GAFFER_API_KEY": "gaf_your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### Project & Test Run Tools

| Tool | Description |
|------|-------------|
| `list_projects` | List all projects you have access to |
| `get_project_health` | Get health metrics (pass rate, flaky count, trends) |
| `list_test_runs` | List recent test runs with optional filtering |
| `get_test_run_details` | Get parsed test results for a specific test run |
| `get_report` | Get report file URLs for a test run |
| `get_report_browser_url` | Get a browser-navigable URL for viewing reports |

### Test Analysis Tools

| Tool | Description |
|------|-------------|
| `get_test_history` | Get pass/fail history for a specific test |
| `get_flaky_tests` | Get tests with high flip rates (pass↔fail) |
| `get_slowest_tests` | Get slowest tests by P95 duration |
| `compare_test_metrics` | Compare test performance between commits |
| `get_failure_clusters` | Group failed tests by root cause (error similarity) |

### Upload & Status Tools

| Tool | Description |
|------|-------------|
| `get_upload_status` | Check if CI results are uploaded and processed |

### Coverage Tools

| Tool | Description |
|------|-------------|
| `get_coverage_summary` | Get overall coverage metrics and trends |
| `get_coverage_for_file` | Get coverage for specific files or paths |
| `get_untested_files` | Get files below a coverage threshold |
| `find_uncovered_failure_areas` | Find files with low coverage AND test failures |

## Tool Details

### `list_projects`

List all projects you have access to.

- **Input:** `organizationId` (optional), `limit` (optional, default: 50)
- **Returns:** List of projects with IDs, names, and organization info
- **Example:** "What projects do I have in Gaffer?"

### `get_project_health`

Get the health metrics for a project.

- **Input:** `projectId` (required), `days` (optional, default: 30)
- **Returns:** Health score (0-100), pass rate, test run count, flaky test count, trend
- **Example:** "What's the health of my test suite?"

### `get_test_history`

Get the pass/fail history for a specific test.

- **Input:** `projectId` (required), `testName` or `filePath` (one required), `limit` (optional)
- **Returns:** History of runs with status, duration, branch, commit, errors
- **Example:** "Is the login test flaky? Check its history"

### `get_flaky_tests`

Get the list of flaky tests in a project.

- **Input:** `projectId` (required), `threshold` (optional, default: 0.1), `days` (optional), `limit` (optional)
- **Returns:** List of flaky tests with flip rates, transition counts, run counts
- **Example:** "Which tests are flaky in my project?"

### `list_test_runs`

List recent test runs with optional filtering.

- **Input:** `projectId` (required), `commitSha` (optional), `branch` (optional), `status` (optional), `limit` (optional)
- **Returns:** List of test runs with pass/fail/skip counts, commit and branch info
- **Example:** "What tests failed in the last commit?"

### `get_test_run_details`

Get parsed test results for a specific test run.

- **Input:** `testRunId` (required), `projectId` (required), `status` (optional filter), `limit` (optional)
- **Returns:** Individual test results with name, status, duration, file path, errors
- **Example:** "Show me all failed tests from this test run"

### `get_report`

Get URLs for report files uploaded with a test run.

- **Input:** `testRunId` (required)
- **Returns:** List of files with filename, size, content type, download URL
- **Example:** "Get the Playwright report for the latest test run"

### `get_report_browser_url`

Get a browser-navigable URL for viewing a test report.

- **Input:** `projectId` (required), `testRunId` (required), `filename` (optional)
- **Returns:** Signed URL valid for 30 minutes
- **Example:** "Give me a link to view the test report"

### `get_slowest_tests`

Get the slowest tests in a project, sorted by P95 duration.

- **Input:** `projectId` (required), `days` (optional), `limit` (optional), `framework` (optional), `branch` (optional)
- **Returns:** List of tests with average and P95 duration, run count
- **Example:** "Which tests are slowing down my CI pipeline?"

### `compare_test_metrics`

Compare test metrics between two commits or test runs.

- **Input:** `projectId` (required), `testName` (required), `beforeCommit`/`afterCommit` OR `beforeRunId`/`afterRunId`
- **Returns:** Before/after metrics with duration change and percentage
- **Example:** "Did my fix make this test faster?"

### `get_coverage_summary`

Get the coverage metrics summary for a project.

- **Input:** `projectId` (required), `days` (optional, default: 30)
- **Returns:** Line/branch/function coverage percentages, trend, report count, lowest coverage files
- **Example:** "What's our test coverage?"

### `get_coverage_for_file`

Get coverage metrics for specific files or paths.

- **Input:** `projectId` (required), `filePath` (required - exact or partial match)
- **Returns:** List of matching files with line/branch/function coverage
- **Example:** "What's the coverage for our API routes?"

### `get_untested_files`

Get files with little or no test coverage.

- **Input:** `projectId` (required), `maxCoverage` (optional, default: 10%), `limit` (optional)
- **Returns:** List of files below threshold sorted by coverage (lowest first)
- **Example:** "Which files have no tests?"

### `find_uncovered_failure_areas`

Find code areas with both low coverage AND test failures (high risk).

- **Input:** `projectId` (required), `days` (optional), `coverageThreshold` (optional, default: 80%)
- **Returns:** Risk areas ranked by score, with file path, coverage %, failure count
- **Example:** "Where should we focus our testing efforts?"

### `get_failure_clusters`

Group failed tests by root cause using error message similarity.

- **Input:** `projectId` (required), `testRunId` (required)
- **Returns:** Clusters of failed tests grouped by similar error messages, with representative error and test count
- **Example:** "Are these 15 failures from the same bug?"

### `get_upload_status`

Check if CI results have been uploaded and processed.

- **Input:** `projectId` (required), `sessionId` (optional), `commitSha` (optional), `branch` (optional)
- **Returns:** Upload session(s) with processing status, linked test runs and coverage reports
- **Example:** "Are my test results ready for commit abc123?"

## Agentic CI Workflows

These workflows show how an AI agent can use Gaffer tools to diagnose CI failures, wait for results, and find coverage gaps.

### Workflow: Diagnose CI Failures

```
list_test_runs(projectId, status="failed")
  → get_test_run_details(projectId, testRunId, status="failed")
  → get_failure_clusters(projectId, testRunId)
  → get_test_history(projectId, testName="...")
  → compare_test_metrics(projectId, testName, beforeCommit, afterCommit)
```

1. Find the failed test run
2. Get individual failure details with stack traces
3. Group failures by root cause — often 15 failures are 2-3 bugs
4. Check if each failure is new (regression) or recurring
5. Verify fixes by comparing before/after

### Workflow: Wait for Results

```
get_upload_status(projectId, commitSha="abc123")
  → poll until processingStatus="completed"
  → get_test_run_details(projectId, testRunId)
```

1. Check if results for a commit have been uploaded
2. Wait for processing to complete
3. Use linked test run IDs to get results

### Workflow: Find Coverage Gaps

```
find_uncovered_failure_areas(projectId)
  → get_untested_files(projectId)
  → get_coverage_for_file(projectId, filePath="src/critical/")
```

1. Find files with both low coverage and test failures (highest risk)
2. Find files with no coverage at all
3. Drill into specific directories for targeted analysis

### Tool Quick Reference

| Agent Question | Tool |
|---|---|
| "What failed?" | `get_test_run_details` |
| "Same root cause?" | `get_failure_clusters` |
| "Is it flaky?" | `get_flaky_tests` |
| "Is this new?" | `get_test_history` |
| "Did my fix work?" | `compare_test_metrics` |
| "Are results ready?" | `get_upload_status` |
| "What's untested?" | `find_uncovered_failure_areas` |
| "What's slow?" | `get_slowest_tests` |

## Prioritizing Coverage Improvements

When using coverage tools to improve your test suite, combine coverage data with codebase exploration for best results:

### 1. Understand Code Utilization

Before targeting files purely by coverage percentage, explore which code is actually critical:

- **Find entry points:** Look for route definitions, event handlers, exported functions - these reveal what code actually executes in production
- **Find heavily-imported files:** Files imported by many others are high-value targets
- **Identify critical business logic:** Look for files handling auth, payments, data mutations, or core domain logic

### 2. Prioritize by Impact

Low coverage alone doesn't indicate priority. Consider:

- **High utilization + low coverage = highest priority** - Code that runs frequently but lacks tests
- **Large files with 0% coverage** - More uncovered lines means bigger impact on overall coverage
- **Files with both failures and low coverage** - Use `find_uncovered_failure_areas` for this

### 3. Use Path-Based Queries

The `get_untested_files` tool may return many frontend components. For backend or specific areas:

```
# Query specific paths with get_coverage_for_file
get_coverage_for_file(filePath="server/services")
get_coverage_for_file(filePath="src/api")
get_coverage_for_file(filePath="lib/core")
```

### 4. Iterative Improvement

1. Get baseline with `get_coverage_summary`
2. Identify targets with `get_coverage_for_file` on critical paths
3. Write tests for highest-impact files
4. Re-check coverage after CI uploads new results
5. Repeat

## Authentication

### User API Keys (Recommended)

User API Keys (`gaf_` prefix) provide read-only access to all projects across your organizations. Get your API Key from: **Account Settings > API Keys**

### Project Upload Tokens (Legacy)

Project Upload Tokens (`gfr_` prefix) are designed for uploading test results and only provide access to a single project. User API Keys are preferred for the MCP server.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GAFFER_API_KEY` | Yes | Your Gaffer API Key (starts with `gaf_`) |
| `GAFFER_API_URL` | No | API base URL (default: `https://app.gaffer.sh`) |

## Local Development

```bash
pnpm install
pnpm build
```

Test locally with Claude Code (use absolute path to built file):

```json
{
  "mcpServers": {
    "gaffer": {
      "command": "node",
      "args": ["/absolute/path/to/dist/index.js"],
      "env": {
        "GAFFER_API_KEY": "gaf_..."
      }
    }
  }
}
```

## License

MIT
