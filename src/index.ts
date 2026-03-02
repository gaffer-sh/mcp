import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { GafferApiClient } from './api-client.js'
import {
  executeCode,
  executeSearchTools,
  FunctionRegistry,
  registerAllTools,
  searchToolsInputSchema,
} from './codemode/index.js'
import {
  executeListProjects,
  listProjectsInputSchema,
  listProjectsMetadata,
  listProjectsOutputSchema,
} from './tools/list-projects.js'

/**
 * Log error to stderr for observability
 * MCP uses stdout for communication, so stderr is safe for logging
 */
function logError(toolName: string, error: unknown): void {
  const timestamp = new Date().toISOString()
  const message = error instanceof Error ? error.message : 'Unknown error'
  const stack = error instanceof Error ? error.stack : undefined
  console.error(`[${timestamp}] [gaffer-mcp] ${toolName} failed: ${message}`)
  if (stack) {
    console.error(stack)
  }
}

/**
 * Handle tool error: log it and return MCP error response
 */
function handleToolError(toolName: string, error: unknown): { content: { type: 'text', text: string }[], isError: true } {
  logError(toolName, error)
  const message = error instanceof Error ? error.message : 'Unknown error'
  const logs = Array.isArray((error as any)?.logs) ? (error as any).logs as string[] : undefined
  const durationMs = typeof (error as any)?.durationMs === 'number' ? (error as any).durationMs : undefined

  let text = `Error: ${message}`
  if (logs?.length) {
    text += `\n\nCaptured logs:\n${logs.join('\n')}`
  }
  if (durationMs !== undefined) {
    text += `\n\nDuration: ${durationMs}ms`
  }

  return {
    content: [{ type: 'text' as const, text }],
    isError: true,
  }
}

/**
 * Gaffer MCP Server — Code Mode
 *
 * Instead of individual tools, exposes 3 tools:
 * - execute_code: Run JavaScript that calls Gaffer API functions
 * - search_tools: Find available functions by keyword
 * - list_projects: List projects (user tokens only)
 *
 * This follows Cloudflare's "code mode" pattern for MCP servers.
 */
async function main() {
  // Validate API key is present
  const apiKey = process.env.GAFFER_API_KEY
  if (!apiKey) {
    console.error('Error: GAFFER_API_KEY environment variable is required')
    console.error('')
    console.error('Get your API Key from: https://app.gaffer.sh/account/api-keys')
    console.error('')
    console.error('Then configure Claude Code or Cursor with:')
    console.error(JSON.stringify({
      mcpServers: {
        gaffer: {
          command: 'npx',
          args: ['-y', '@gaffer-sh/mcp'],
          env: {
            GAFFER_API_KEY: 'gaf_your-api-key-here',
          },
        },
      },
    }, null, 2))
    process.exit(1)
  }

  // Create API client
  const client = GafferApiClient.fromEnv()

  // Build codemode registry
  const registry = new FunctionRegistry()
  registerAllTools(registry)
  const namespace = registry.buildNamespace(client)
  const declarations = registry.generateAllDeclarations()

  // Create MCP server
  const server = new McpServer(
    {
      name: 'gaffer',
      version: '0.7.0',
    },
    {
      instructions: `Gaffer provides test analytics and coverage data. This server uses **code mode** — instead of individual tools, write JavaScript that calls functions on the \`codemode\` namespace.

## Authentication

${client.isUserToken()
  ? 'You have a user API key with access to multiple projects. Use `list_projects` to find project IDs, then pass `projectId` to all codemode functions.'
  : 'Your token is scoped to a single project. Do NOT pass `projectId` — it resolves automatically.'}

## How to Use

1. Use \`search_tools\` to find relevant functions (or check the execute_code description for all declarations)
2. Use \`execute_code\` to run JavaScript that calls one or more functions
3. Results are returned as JSON — you can chain multiple calls in a single execution

## Example

\`\`\`javascript
// Get project health, then check flaky tests if any exist
const health = await codemode.get_project_health({ projectId: "proj_abc" });
if (health.flakyTestCount > 0) {
  const flaky = await codemode.get_flaky_tests({ projectId: "proj_abc" });
  return { health, flaky };
}
return { health };
\`\`\`

## Tips

- Use \`return\` to send data back — the return value becomes the tool result
- Use \`console.log()\` for debug output (captured and returned alongside results)
- You can make up to 20 API calls per execution
- All functions are async — use \`await\``,
    },
  )

  // Register execute_code tool
  server.registerTool(
    'execute_code',
    {
      title: 'Execute Code',
      description: `Execute JavaScript code that calls Gaffer API functions via the \`codemode\` namespace.

Write async JavaScript — all functions are available as \`codemode.<function_name>(input)\`.
Use \`return\` to send results back. Use \`console.log()\` for debug output.

## Available Functions

\`\`\`typescript
${declarations}
\`\`\`

## Examples

\`\`\`javascript
// Single call
const health = await codemode.get_project_health({ projectId: "proj_abc" });
return health;
\`\`\`

\`\`\`javascript
// Multi-step: get flaky tests and check history for each
const flaky = await codemode.get_flaky_tests({ projectId: "proj_abc", limit: 5 });
const histories = [];
for (const test of flaky.flakyTests) {
  const history = await codemode.get_test_history({ projectId: "proj_abc", testName: test.name, limit: 5 });
  histories.push({ test: test.name, score: test.flakinessScore, history: history.summary });
}
return { flaky: flaky.summary, details: histories };
\`\`\`

\`\`\`javascript
// Coverage analysis
const summary = await codemode.get_coverage_summary({ projectId: "proj_abc" });
const lowFiles = await codemode.get_coverage_for_file({ projectId: "proj_abc", maxCoverage: 50, limit: 10 });
return { summary, lowCoverageFiles: lowFiles };
\`\`\`

## Constraints

- Max 20 API calls per execution
- 30s timeout
- No access to Node.js globals (process, require, etc.)`,
      inputSchema: {
        code: z.string().describe('JavaScript code to execute. Use `codemode.<function>()` to call API functions. Use `return` for results.'),
      },
    },
    async (input: { code: string }) => {
      try {
        const result = await executeCode(input.code, namespace)
        const output: Record<string, unknown> = {}

        if (result.result !== undefined) {
          output.result = result.result
        }
        if (result.logs.length > 0) {
          output.logs = result.logs
        }
        output.durationMs = result.durationMs

        let text: string
        try {
          text = JSON.stringify(output, null, 2)
        }
        catch {
          text = JSON.stringify({
            error: 'Result could not be serialized to JSON (possible circular reference). Use console.log() to inspect the result, or return a simpler object.',
            logs: result.logs.length > 0 ? result.logs : undefined,
            durationMs: result.durationMs,
          })
        }

        return {
          content: [{ type: 'text' as const, text }],
        }
      }
      catch (error) {
        return handleToolError('execute_code', error)
      }
    },
  )

  // Register search_tools tool
  server.registerTool(
    'search_tools',
    {
      title: 'Search Tools',
      description: `Search for available Gaffer API functions by keyword.

Returns matching functions with their TypeScript declarations so you can use them with execute_code.

Examples:
- "coverage" → coverage-related functions
- "flaky" → flaky test detection
- "" (empty) → list all available functions`,
      inputSchema: searchToolsInputSchema,
    },
    async (input: { query?: string }) => {
      try {
        const result = executeSearchTools(registry, input)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      }
      catch (error) {
        return handleToolError('search_tools', error)
      }
    },
  )

  // Register list_projects tool (user tokens only)
  if (client.isUserToken()) {
    server.registerTool(
      listProjectsMetadata.name,
      {
        title: listProjectsMetadata.title,
        description: listProjectsMetadata.description,
        inputSchema: listProjectsInputSchema,
        outputSchema: listProjectsOutputSchema,
      },
      async (input: { organizationId?: string, limit?: number }) => {
        try {
          const output = await executeListProjects(client, input)
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(output, null, 2) }],
            structuredContent: output as unknown as Record<string, unknown>,
          }
        }
        catch (error) {
          return handleToolError(listProjectsMetadata.name, error)
        }
      },
    )
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
