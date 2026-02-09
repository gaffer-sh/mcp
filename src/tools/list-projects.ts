import type { GafferApiClient } from '../api-client.js'
import { z } from 'zod'

/**
 * Input schema for list_projects tool
 */
export const listProjectsInputSchema = {
  organizationId: z
    .string()
    .optional()
    .describe('Filter by organization ID (optional)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Maximum number of projects to return (default: 50)'),
}

/**
 * Output schema for list_projects tool
 */
export const listProjectsOutputSchema = {
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    organization: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
    }),
  })),
  total: z.number(),
}

export interface ListProjectsInput {
  organizationId?: string
  limit?: number
}

export interface ListProjectsOutput {
  projects: Array<{
    id: string
    name: string
    description?: string | null
    organization: {
      id: string
      name: string
      slug: string
    }
  }>
  total: number
}

/**
 * Execute list_projects tool
 */
export async function executeListProjects(
  client: GafferApiClient,
  input: ListProjectsInput,
): Promise<ListProjectsOutput> {
  const response = await client.listProjects({
    organizationId: input.organizationId,
    limit: input.limit,
  })

  return {
    projects: response.projects.map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      organization: p.organization,
    })),
    total: response.pagination.total,
  }
}

/**
 * Tool metadata
 */
export const listProjectsMetadata = {
  name: 'list_projects',
  title: 'List Projects',
  description: `List all projects you have access to.

Returns a list of projects with their IDs, names, and organization info.
Use this to find project IDs for other tools like get_project_health.

Requires a user API Key (gaf_). Get one from Account Settings in the Gaffer dashboard.`,
}
