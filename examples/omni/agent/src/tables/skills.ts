/**
 * Skills Table - Repository of agent skills
 *
 * This table stores skills that provide knowledge and instructions to agents.
 * Skills are prompt-based - they contain markdown content that guides agent behavior.
 */

import { Table, z } from '@botpress/runtime'

/**
 * How a skill was created
 */
export const SkillSourceEnum = z.enum(['seed', 'discovered', 'user'])
export type SkillSource = z.infer<typeof SkillSourceEnum>

/**
 * SkillsTable - stores skills with semantic search capabilities
 */
export const SkillsTable = new Table({
  name: 'SkillsTable',
  description: 'Repository of agent skills',
  columns: {
    // Identity
    name: {
      schema: z.string().describe('Unique skill identifier'),
      searchable: true,
    },
    displayName: {
      schema: z.string().describe('Human-readable name'),
      searchable: true,
    },
    description: {
      schema: z.string().describe('What this skill does'),
      searchable: true,
    },

    // Metadata
    source: {
      schema: SkillSourceEnum.describe('How the skill was created'),
      searchable: false,
    },

    // Content
    promptContent: {
      schema: z.string().describe('Markdown content for prompt injection'),
      searchable: true,
    },

    // Requirements - stored as JSON strings for table compatibility
    requiresBins: {
      schema: z.string().optional().describe('JSON array of required CLI binaries'),
      searchable: false,
    },
    requiresEnvVars: {
      schema: z.string().optional().describe('JSON array of required environment variables'),
      searchable: false,
    },
    requiresPlatform: {
      schema: z.string().optional().describe('JSON array: darwin, linux, win32'),
      searchable: false,
    },

    // Installation
    installInstructions: {
      schema: z.string().optional().describe('JSON array of install instructions'),
      searchable: false,
    },

    // Metadata
    version: {
      schema: z.number().default(1).describe('Skill version number'),
      searchable: false,
    },
    tags: {
      schema: z.string().optional().describe('JSON array of tags'),
      searchable: true,
    },
    userInvocable: {
      schema: z.boolean().default(false).describe('Whether users can invoke via /command'),
      searchable: false,
    },
    priority: {
      schema: z.number().default(0).describe('Priority for ordering in prompt'),
      searchable: false,
    },
    emoji: {
      schema: z.string().optional().describe('Display emoji'),
      searchable: false,
    },
  },
  keyColumn: 'name',
})

/**
 * Type for a skill row input (what we insert)
 */
export type SkillRowInput = {
  name: string
  displayName: string
  description: string
  source: SkillSource
  promptContent: string
  requiresBins?: string
  requiresEnvVars?: string
  requiresPlatform?: string
  installInstructions?: string
  version?: number
  tags?: string
  userInvocable?: boolean
  priority?: number
  emoji?: string
}

/**
 * Type for a skill row returned from the table (includes generated fields)
 */
export type SkillRow = SkillRowInput & {
  id: number
  createdAt: string
  updatedAt: string
  // Fields with defaults are now required in output
  version: number
  userInvocable: boolean
  priority: number
}

/**
 * Helper to parse JSON array fields safely
 */
export function parseJsonArray<T>(json: string | undefined): T[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Helper to stringify array fields for storage
 */
export function stringifyArray<T>(arr: T[] | undefined): string | undefined {
  if (!arr || arr.length === 0) return undefined
  return JSON.stringify(arr)
}
