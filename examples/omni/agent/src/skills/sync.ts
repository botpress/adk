/**
 * Skill sync - syncs skills from local-plane to the agent's table
 *
 * This module calls the local-plane /skills/list endpoint and upserts
 * the skills into the SkillsTable.
 */

import { callLocalPlane } from '../bridge/client.js'
import { SkillsTable, type SkillRowInput } from '../tables/skills.js'
import type { ToolContext } from '../tools/types.js'

/**
 * Skill data received from local-plane API
 */
export type SkillData = {
  name: string
  displayName: string
  description: string
  promptContent: string
  requiresBins?: string
  requiresEnvVars?: string
  requiresPlatform?: string
  installInstructions?: string
  version: number
  tags?: string
  userInvocable: boolean
  priority: number
  emoji?: string
}

/**
 * Response from /skills/list endpoint
 */
type SkillsListResponse = {
  skills: SkillData[]
}

/**
 * Result of syncing skills from local-plane
 */
export type SyncResult = {
  synced: number
  inserted: number
  updated: number
  errors: string[]
}

/**
 * Sync skills from local-plane to the agent's table
 *
 * Calls /skills/list and upserts each skill into SkillsTable.
 */
export async function syncSkillsFromLocalPlane(config: ToolContext['config']): Promise<SyncResult> {
  const errors: string[] = []

  // Fetch skills from local-plane
  let skills: SkillData[]
  try {
    const response = await callLocalPlane<Record<string, never>, SkillsListResponse>(
      '/skills/list',
      {},
      config
    )
    skills = response.skills
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      synced: 0,
      inserted: 0,
      updated: 0,
      errors: [`Failed to fetch skills from local-plane: ${message}`],
    }
  }

  if (skills.length === 0) {
    return {
      synced: 0,
      inserted: 0,
      updated: 0,
      errors: [],
    }
  }

  // Convert to table rows
  const rows: SkillRowInput[] = skills.map((skill) => ({
    name: skill.name,
    displayName: skill.displayName,
    description: skill.description,
    source: 'seed' as const,
    promptContent: skill.promptContent,
    requiresBins: skill.requiresBins,
    requiresEnvVars: skill.requiresEnvVars,
    requiresPlatform: skill.requiresPlatform,
    installInstructions: skill.installInstructions,
    version: skill.version,
    tags: skill.tags,
    userInvocable: skill.userInvocable,
    priority: skill.priority,
    emoji: skill.emoji,
  }))

  // Upsert into table
  try {
    const result = await SkillsTable.upsertRows({
      rows,
      keyColumn: 'name',
    })

    return {
      synced: skills.length,
      inserted: result.inserted.length,
      updated: result.updated.length,
      errors,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    errors.push(`Failed to upsert skills to table: ${message}`)
    return {
      synced: 0,
      inserted: 0,
      updated: 0,
      errors,
    }
  }
}

/**
 * Check if skills have been synced by looking for any 'seed' source rows
 */
export async function isSynced(): Promise<boolean> {
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
