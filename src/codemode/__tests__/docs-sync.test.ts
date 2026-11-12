import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { registerAllTools } from '../register-tools.js'
import { FunctionRegistry } from '../registry.js'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(relativePath: string): string {
  return readFileSync(join(PACKAGE_ROOT, relativePath), 'utf-8')
}

const readme = read('README.md')

function registeredNames(): string[] {
  const registry = new FunctionRegistry()
  registerAllTools(registry)
  return registry.getAll().map(e => e.name)
}

/**
 * The README is what npm, the public repo, and every MCP directory scrape. It
 * drifted once already: it advertised 16 first-class MCP tools when the server
 * exposes 3 in code mode, and omitted search_failures entirely. These tests
 * pin the two claims that drifted.
 */
describe('rEADME stays in sync with the codemode registry', () => {
  it('documents every registered codemode function', () => {
    for (const name of registeredNames()) {
      expect(readme, `README is missing codemode function \`${name}\``).toContain(`\`${name}\``)
    }
  })

  it('states the registry size in its function-count sentence', () => {
    const count = readme.match(/namespace of (\d+) functions/)?.[1]
    expect(count, 'README needs a "namespace of N functions" sentence').toBe(String(registeredNames().length))
  })

  it('documents the three real MCP tools', () => {
    for (const tool of ['execute_code', 'search_tools', 'list_projects']) {
      expect(readme).toContain(`\`${tool}\``)
    }
  })

  it('does not describe codemode functions as MCP tools', () => {
    expect(readme).not.toMatch(/^## Available Tools$/m)
    expect(readme).toMatch(/^## Functions available via `execute_code`$/m)
  })
})

describe('version stays consistent across the package', () => {
  it('src/codemode/server.ts reports the package.json version', () => {
    const { version } = JSON.parse(read('package.json')) as { version: string }
    const serverTs = read('src/codemode/server.ts')

    // The McpServer constructor hardcodes the version; bumpp only touches
    // package.json, so these silently diverge without this assertion.
    expect(serverTs).toContain(`version: '${version}'`)
  })
})

/**
 * The MCP registry rejects a publish outright when server.json disagrees with
 * package.json, so these are release blockers rather than style nits. bumpp
 * only bumps package.json, which makes drift the default without this test.
 */
describe('server.json satisfies the MCP registry contract', () => {
  const pkg = JSON.parse(read('package.json')) as { version: string, mcpName: string }
  const server = JSON.parse(read('server.json')) as {
    name: string
    description: string
    version: string
    packages: { identifier: string, version: string, transport: { type: string } }[]
    remotes: { type: string, url: string, headers?: { name: string, isRequired?: boolean }[] }[]
  }

  it('name matches package.json mcpName', () => {
    expect(server.name).toBe(pkg.mcpName)
  })

  it('uses the reverse-DNS namespace pattern the registry requires', () => {
    expect(server.name).toMatch(/^[a-z0-9.-]+\/[\w.-]+$/i)
  })

  it('version and package version both match package.json', () => {
    expect(server.version).toBe(pkg.version)
    expect(server.packages[0].version).toBe(pkg.version)
  })

  it('points at the published npm package over stdio', () => {
    expect(server.packages[0].identifier).toBe('@gaffer-sh/mcp')
    expect(server.packages[0].transport.type).toBe('stdio')
  })

  it('declares the hosted endpoint, with the API key header optional because OAuth also works', () => {
    expect(server.remotes).toEqual([expect.objectContaining({ type: 'streamable-http', url: 'https://app.gaffer.sh/mcp' })])
    expect(server.remotes[0].headers).toEqual([expect.objectContaining({ name: 'Authorization', isRequired: false })])
  })

  it('description fits the registry 100-character limit', () => {
    expect(server.description.length).toBeLessThanOrEqual(100)
  })
})
