# AGENTS.md

MCP server for Gaffer. TypeScript, built with tsdown, published to npm as `@gaffer-sh/mcp`.

## Architecture

This server is an **external API consumer**. It calls Gaffer's public `/api/v1/` endpoints over HTTP like any third-party client, and never bypasses the public API. If an endpoint does not support what a function needs, the fix belongs in the API, not here.

The server runs in **code mode**: three MCP tools plus a `codemode` namespace of 17 functions that `execute_code` calls from sandboxed JavaScript. That keeps 17 tool definitions out of the client's context window and lets one execution chain several calls.

| Path | What it holds |
|---|---|
| `src/index.ts` | stdio entry point: builds the client from env and connects the server over stdio |
| `src/codemode/` | MCP server and its three tool registrations (`server.ts`), registry, executor, type generation, keyword search. Exported as `@gaffer-sh/mcp/codemode` for hosts that serve it over HTTP |
| `src/tools/` | One file per function: `inputSchema`, `execute`, `metadata` |
| `src/api-client.ts` | HTTP client for the Gaffer API |
| `src/types.ts` | Shared types |

## Commands

```sh
pnpm install
pnpm build       # tsdown, then chmod +x dist/index.js
pnpm test        # vitest
pnpm typecheck
```

## Adding a function

1. Create `src/tools/<name>.ts` matching the existing shape.
2. Add an API client method if needed.
3. Register it in `src/codemode/register-tools.ts` with a category and keywords.
4. Add it to the function table in `README.md`.

Step 4 is enforced: `src/codemode/__tests__/docs-sync.test.ts` fails if a registered function is undocumented. The README is what npm and every MCP directory scrape, so it drifting is a distribution problem, not a docs nit.

Functions go in the codemode registry, not in the MCP tool list. Only add a first-class MCP tool when a client needs it before any code executes.

## Environment

| Variable | Required | Description |
|---|---|---|
| `GAFFER_API_KEY` | Yes | `gaf_` user key or `gfr_` project token |
| `GAFFER_API_URL` | No | Defaults to `https://app.gaffer.sh` |

`gaf_` keys read across projects and enable `list_projects`. `gfr_` tokens are scoped to one project, and `projectId` resolves automatically, so callers must omit it.

## Release

The version appears in `package.json`, `src/codemode/server.ts`, and `server.json` (twice). All must match before publishing, and `server.json`'s `name` must equal `package.json`'s `mcpName`. The MCP registry rejects a mismatch outright. `docs-sync.test.ts` checks all of it.
