/**
 * Seed data utilities for skills table
 *
 * This module provides functions to query skills from the SkillsTable.
 * Skills are now synced from local-plane via the sync.ts module.
 */

import { SkillsTable, type SkillRow, type SkillRowInput, stringifyArray } from '../tables/skills.js'
import type { Skill } from './types.js'

/**
 * Convert a filesystem Skill to a SkillRow for the table
 * (kept for compatibility with table-loader.ts)
 */
export function skillToRow(skill: Skill): Omit<SkillRow, 'id' | 'createdAt' | 'updatedAt'> {
  const metadata = skill.metadata

  return {
    // Identity
    name: skill.name,
    displayName: skill.frontmatter.name || skill.name,
    description: skill.description || skill.name,

    // Source - seed skills come from local-plane
    source: 'seed',

    // Content
    promptContent: skill.content,

    // Requirements
    requiresBins: stringifyArray(metadata.requires?.bins),
    requiresEnvVars: stringifyArray(metadata.requires?.envVars),
    requiresPlatform: stringifyArray(
      metadata.requires?.platform
        ? Array.isArray(metadata.requires.platform)
          ? metadata.requires.platform
          : [metadata.requires.platform]
        : undefined
    ),

    // Installation - serialize the full instruction objects
    installInstructions: metadata.install ? JSON.stringify(metadata.install) : undefined,

    // Metadata
    version: 1,
    tags: stringifyArray(skill.frontmatter.tags),
    userInvocable: skill.frontmatter.userInvocable ?? false,
    priority: skill.frontmatter.priority ?? 0,
    emoji: metadata.emoji,
  }
}

/**
 * Check if skills have been seeded by looking for any 'seed' source rows
 */
export async function isSeeded(): Promise<boolean> {
  try {
    const result = await SkillsTable.findRows({
      filter: { source: 'seed' },
      limit: 1,
    })
    return result.rows.length > 0
  } catch {
    // Table might not exist yet
    return false
  }
}

/**
 * Get a skill by name from the table
 */
export async function getSkillFromTable(name: string): Promise<SkillRow | null> {
  const result = await SkillsTable.findRows({
    filter: { name },
    limit: 1,
  })

  if (result.rows.length === 0) {
    return null
  }

  return result.rows[0] as unknown as SkillRow
}

/**
 * Search skills by semantic query
 */
export async function searchSkills(
  query: string,
  options?: {
    limit?: number
    source?: 'seed' | 'discovered' | 'user'
  }
): Promise<SkillRow[]> {
  const { limit = 10, source } = options || {}

  const result = await SkillsTable.findRows({
    search: query,
    limit,
    ...(source && { filter: { source } }),
  })

  return result.rows as unknown as SkillRow[]
}

/**
 * List all skills, optionally filtered
 */
export async function listSkillsFromTable(options?: {
  source?: 'seed' | 'discovered' | 'user'
  limit?: number
  offset?: number
}): Promise<{ skills: SkillRow[]; hasMore: boolean }> {
  const { source, limit = 100, offset = 0 } = options || {}

  const result = await SkillsTable.findRows({
    limit,
    offset,
    orderBy: 'priority',
    orderDirection: 'desc',
    ...(source && { filter: { source } }),
  })

  return {
    skills: result.rows as unknown as SkillRow[],
    hasMore: result.hasMore,
  }
}
