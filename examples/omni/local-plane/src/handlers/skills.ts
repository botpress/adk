/**
 * Skills endpoint handler
 *
 * Loads skills from the workspace skills directory and returns them as JSON.
 */

import type { Context } from 'hono'
import { join } from 'path'
import { getWorkspacePath } from '../auth.js'
import { loadSkillsAsData, type SkillData } from '../lib/skill-loader.js'

export type { SkillData }

export type SkillsListOutput = {
  skills: SkillData[]
}

/**
 * Get the skills directory path
 */
function getSkillsPath(): string {
  const workspace = getWorkspacePath()
  return join(workspace, 'skills')
}

/**
 * Load all skills from the workspace
 */
export function loadSkills(): SkillsListOutput {
  const skillsDir = getSkillsPath()
  const skills = loadSkillsAsData(skillsDir)
  return { skills }
}

/**
 * Handle GET /skills/list endpoint
 */
export async function handleSkillsList(c: Context): Promise<Response> {
  try {
    const result = loadSkills()
    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
