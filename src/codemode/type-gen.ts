import { z } from 'zod'

/**
 * Convert a Zod schema to a TypeScript type string.
 * Handles the subset of Zod types used in our tool schemas.
 */
export function zodToTs(schema: z.ZodTypeAny): string {
  // Unwrap effects (e.g., .transform, .refine)
  if (schema instanceof z.ZodEffects) {
    return zodToTs(schema.innerType())
  }

  // Optional — unwrap and emit union with undefined
  if (schema instanceof z.ZodOptional) {
    return `${zodToTs(schema.unwrap())} | undefined`
  }

  // Nullable
  if (schema instanceof z.ZodNullable) {
    return `${zodToTs(schema.unwrap())} | null`
  }

  // Default — unwrap inner type
  if (schema instanceof z.ZodDefault) {
    return zodToTs(schema.removeDefault())
  }

  // Primitives
  if (schema instanceof z.ZodString)
    return 'string'
  if (schema instanceof z.ZodNumber)
    return 'number'
  if (schema instanceof z.ZodBoolean)
    return 'boolean'

  // Enum
  if (schema instanceof z.ZodEnum) {
    const values = schema.options as string[]
    return values.map(v => `'${v}'`).join(' | ')
  }

  // Literal
  if (schema instanceof z.ZodLiteral) {
    const val = schema.value
    return typeof val === 'string' ? `'${val}'` : String(val)
  }

  // Array
  if (schema instanceof z.ZodArray) {
    const inner = zodToTs(schema.element)
    // Wrap union types in parens for clarity
    if (inner.includes('|')) {
      return `(${inner})[]`
    }
    return `${inner}[]`
  }

  // Object
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>
    const entries = Object.entries(shape)
    if (entries.length === 0)
      return '{}'

    const fields = entries.map(([key, fieldSchema]) => formatField(key, fieldSchema))
    return `{ ${fields.join('; ')} }`
  }

  // Record
  if (schema instanceof z.ZodRecord) {
    return `Record<string, ${zodToTs(schema.valueSchema)}>`
  }

  // Union
  if (schema instanceof z.ZodUnion) {
    const options = schema.options as z.ZodTypeAny[]
    return options.map(o => zodToTs(o)).join(' | ')
  }

  // Fallback — warn so tool authors discover they need to extend zodToTs
  console.error(`[gaffer-mcp] zodToTs: unhandled Zod type "${schema.constructor.name}", falling back to "unknown"`)
  return 'unknown'
}

/**
 * Format a single field as "name?: type" (with ? for optionals, unwrapping the inner type).
 */
function formatField(key: string, schema: z.ZodTypeAny): string {
  const isOptional = schema instanceof z.ZodOptional
  const optMark = isOptional ? '?' : ''
  const tsType = isOptional ? zodToTs(schema.unwrap()) : zodToTs(schema)
  return `${key}${optMark}: ${tsType}`
}

/**
 * Generate a TypeScript function declaration from a function name,
 * description, and Zod input schema (object shape).
 */
export function generateDeclaration(
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodTypeAny>,
): string {
  const entries = Object.entries(inputSchema)

  if (entries.length === 0) {
    return `/** ${description} */\n${name}(): Promise<any>`
  }

  const params = entries.map(([key, schema]) => formatField(key, schema))

  return `/** ${description} */\n${name}(input: { ${params.join('; ')} }): Promise<any>`
}
