#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { GafferApiClient } from './api-client.js'
import { createGafferMcpServer, executeCode } from './codemode/index.js'

/**
 * Gaffer MCP Server over stdio. The server itself is built in
 * `codemode/server.ts`, shared with HTTP hosts.
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

  const server = createGafferMcpServer(GafferApiClient.fromEnv(), executeCode)

  // Connect via stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
