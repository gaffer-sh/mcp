import type { ExecutionResult } from './types.js'

/**
 * Patterns blocked from user code as a basic guard.
 * This is NOT a sandbox — determined users can bypass these checks via
 * string concatenation, bracket notation, or constructor access.
 * The real security boundary is the API layer (read-only, user's own token).
 */
const BLOCKED_PATTERNS = [
  'globalThis',
  'process',
  'require(',
  'import ',
  'import(',
  'eval(',
  'new Function',
  'Function(',
  'Buffer',
  '__dirname',
  '__filename',
  '.constructor',
  'Reflect',
]

/** Maximum API calls per execution */
const MAX_API_CALLS = 20

/** Execution timeout in milliseconds */
const EXECUTION_TIMEOUT_MS = 30_000

/**
 * Validate code doesn't contain blocked patterns.
 * Returns the first blocked pattern found, or null if safe.
 */
export function validateCode(code: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (code.includes(pattern)) {
      return pattern
    }
  }
  return null
}

/**
 * Execute user-provided JavaScript code with access to the codemode namespace.
 *
 * Uses AsyncFunction constructor to run code in an async context.
 * The namespace object is injected as `codemode` — all API calls go through it.
 *
 * Security notes:
 * - Not a true sandbox (no vm2/isolated-vm) — same pattern as Cloudflare code mode
 * - Blocked patterns prevent obvious escape hatches
 * - API call counting prevents resource exhaustion
 * - Timeout prevents infinite loops
 * - The real security boundary is the API itself (read-only, user's own token)
 */
export async function executeCode(
  code: string,
  namespace: Record<string, (...args: any[]) => Promise<any>>,
): Promise<ExecutionResult> {
  // Validate code
  const blocked = validateCode(code)
  if (blocked) {
    throw new Error(`Blocked pattern detected: "${blocked}". Code must not use ${blocked}.`)
  }

  const logs: string[] = []
  const start = Date.now()

  // Serialize a value for console output, handling circular references
  const serialize = (a: any): string => {
    if (typeof a !== 'object' || a === null)
      return String(a)
    try {
      return JSON.stringify(a)
    }
    catch {
      return String(a)
    }
  }

  // Create a safe console that captures output
  const safeConsole = {
    log: (...args: any[]) => logs.push(args.map(serialize).join(' ')),
    warn: (...args: any[]) => logs.push(`[warn] ${args.map(serialize).join(' ')}`),
    error: (...args: any[]) => logs.push(`[error] ${args.map(serialize).join(' ')}`),
  }

  // Wrap namespace functions with call counting
  let callCount = 0
  const countedNamespace: Record<string, (...args: any[]) => Promise<any>> = {}
  for (const [name, fn] of Object.entries(namespace)) {
    countedNamespace[name] = async (...args: any[]) => {
      callCount++
      if (callCount > MAX_API_CALLS) {
        throw new Error(`API call limit exceeded (max ${MAX_API_CALLS} calls per execution)`)
      }
      return fn(...args)
    }
  }

  // No global AsyncFunction — access it via the async function prototype chain
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...args: any[]) => Promise<any>
  const fn = new AsyncFunction('codemode', 'console', code)

  let timeoutId: ReturnType<typeof setTimeout>
  const resultPromise = fn(countedNamespace, safeConsole)
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Execution timed out after ${EXECUTION_TIMEOUT_MS}ms`)), EXECUTION_TIMEOUT_MS)
  })

  try {
    const result = await Promise.race([resultPromise, timeoutPromise])

    return {
      result,
      logs,
      durationMs: Date.now() - start,
    }
  }
  catch (error) {
    const durationMs = Date.now() - start
    const message = error instanceof Error ? error.message : String(error)

    const enrichedError = new Error(message, { cause: error })
    ;(enrichedError as any).logs = logs
    ;(enrichedError as any).durationMs = durationMs
    throw enrichedError
  }
  finally {
    clearTimeout(timeoutId!)
  }
}
