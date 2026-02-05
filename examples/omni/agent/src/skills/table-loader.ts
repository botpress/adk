/**
 * Table-based skill loader
 *
 * Loads skills from the SkillsTable with filesystem fallback.
 * This module provides the same interface as loader.ts but queries
 * the table first, falling back to filesystem for development.
 */

import {
  SkillsTable,
  type SkillRow,
  parseJsonArray,
} from '../tables/skills.js'
import {
  loadSkills as loadSkillsFromFilesystem,
  checkSkillEligibility as checkFsSkillEligibility,
  formatSkillsForPrompt as formatFsSkillsForPrompt,
  buildSkillSnapshot as buildFsSkillSnapshot,
} from './loader.js'
import type {
  Skill,
  SkillEligibility,
  SkillLoadOptions,
  SkillSnapshot,
  SkillMetadata,
  SkillFrontmatter,
  InstallInstruction,
} from './types.js'
import { checkBinaryExists, getCurrentPlatform } from './utils.js'

/**
 * Convert a SkillRow back to a Skill object for compatibility
 */
export function rowToSkill(row: SkillRow & { id: number }): Skill {
  const metadata: SkillMetadata = {
    emoji: row.emoji,
    requires: {
      bins: parseJsonArray<string>(row.requiresBins),
      envVars: parseJsonArray<string>(row.requiresEnvVars),
      platform: parseJsonArray<string>(row.requiresPlatform),
    },
    install: parseJsonArray<InstallInstruction>(row.installInstructions),
  }

  const frontmatter: SkillFrontmatter = {
    name: row.displayName,
    description: row.description,
    tags: parseJsonArray<string>(row.tags),
    userInvocable: row.userInvocable,
    priority: row.priority,
    metadata: { omni: metadata },
  }

  return {
    name: row.name,
    description: row.description,
    filePath: `table://${row.name}`, // Virtual path for table-loaded skills
    baseDir: '',
    frontmatter,
    metadata,
    content: row.promptContent,
    rawContent: row.promptContent,
    source: row.source,
  }
}

/**
 * Check if a table skill's requirements are met
 */
export function checkTableSkillEligibility(row: SkillRow): SkillEligibility {
  const result: SkillEligibility = { eligible: true }

  // Check required binaries
  const bins = parseJsonArray<string>(row.requiresBins)
  if (bins.length > 0) {
    const missing = bins.filter((bin) => !checkBinaryExists(bin))
    if (missing.length > 0) {
      result.eligible = false
      result.missingBins = missing
    }
  }

  // Check environment variables
  const envVars = parseJsonArray<string>(row.requiresEnvVars)
  if (envVars.length > 0) {
    const missing = envVars.filter((v) => !process.env[v])
    if (missing.length > 0) {
      result.eligible = false
      result.missingEnvVars = missing
    }
  }

  // Check platform
  const platforms = parseJsonArray<string>(row.requiresPlatform)
  if (platforms.length > 0) {
    const current = getCurrentPlatform()
    if (!platforms.includes(current)) {
      result.eligible = false
      result.platformMismatch = true
    }
  }

  // Find available install options
  if (result.missingBins && result.missingBins.length > 0) {
    const installs = parseJsonArray<InstallInstruction>(row.installInstructions)
    result.availableInstalls = installs.filter((inst) =>
      inst.bins.some((bin) => result.missingBins?.includes(bin))
    )
  }

  return result
}

/**
 * Load skills from the table
 *
 * @param options Load options
 * @param useFilesystemFallback If true, falls back to filesystem on table error
 */
export async function loadSkillsFromTable(
  options: SkillLoadOptions = {},
  useFilesystemFallback = true
): Promise<Skill[]> {
  const { skillFilter, checkRequirements = false, includeIneligible = false } = options

  try {
    // Build filter
    const filter: Record<string, unknown> = {}
    if (skillFilter && skillFilter.length > 0) {
      filter.name = { $in: skillFilter }
    }

    // Query table
    const result = await SkillsTable.findRows({
      filter: Object.keys(filter).length > 0 ? filter : undefined,
      orderBy: 'priority',
      orderDirection: 'desc',
      limit: 1000, // Reasonable limit for skills
    })

    let skills = result.rows.map((row) =>
      rowToSkill(row as unknown as SkillRow & { id: number })
    )

    // Filter by eligibility if requested
    if (checkRequirements && !includeIneligible) {
      skills = skills.filter((skill) => {
        // Convert back to row format for eligibility check
        const row = result.rows.find(
          (r) => (r as unknown as SkillRow).name === skill.name
        ) as unknown as SkillRow
        return row ? checkTableSkillEligibility(row).eligible : true
      })
    }

    return skills
  } catch (error) {
    // Fall back to filesystem loading
    if (useFilesystemFallback) {
      console.warn('Failed to load skills from table, falling back to filesystem:', error)
      return loadSkillsFromFilesystem(options)
    }
    throw error
  }
}

/**
 * Get a skill by name from the table
 */
export async function getSkillFromTable(
  name: string,
  useFilesystemFallback = true
): Promise<Skill | undefined> {
  try {
    const result = await SkillsTable.findRows({
      filter: { name },
      limit: 1,
    })

    if (result.rows.length > 0) {
      return rowToSkill(result.rows[0] as unknown as SkillRow & { id: number })
    }

    return undefined
  } catch (error) {
    if (useFilesystemFallback) {
      console.warn('Failed to get skill from table, falling back to filesystem:', error)
      const skills = loadSkillsFromFilesystem({ skillFilter: [name] })
      return skills[0]
    }
    throw error
  }
}

/**
 * Search skills by semantic query
 */
export async function searchSkillsFromTable(
  query: string,
  options?: {
    limit?: number
    checkRequirements?: boolean
  }
): Promise<Array<{ skill: Skill; eligibility: SkillEligibility; similarity: number }>> {
  const { limit = 10, checkRequirements = false } = options || {}

  const result = await SkillsTable.findRows({
    search: query,
    limit,
  })

  return result.rows.map((row) => {
    const typedRow = row as unknown as SkillRow & { id: number; similarity: number }
    const skill = rowToSkill(typedRow)
    const eligibility = checkRequirements
      ? checkTableSkillEligibility(typedRow)
      : { eligible: true }

    return {
      skill,
      eligibility,
      similarity: typedRow.similarity || 1,
    }
  })
}

/**
 * Format skills from table for prompt injection
 */
export function formatTableSkillsForPrompt(skills: Skill[]): string {
  // Filter to only skills that should be in prompt
  const promptSkills = skills.filter((s) => s.frontmatter.includeInPrompt !== false)

  if (promptSkills.length === 0) {
    return ''
  }

  // Escape XML special characters
  const escapeXml = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const skillBlocks = promptSkills.map((skill) => {
    const name = skill.name
    const description = escapeXml(skill.description || skill.name)
    const location = skill.filePath.startsWith('table://')
      ? `skill://${name}` // Virtual location for table skills
      : skill.filePath

    return `<skill name="${escapeXml(name)}">
  <description>${description}</description>
  <location>${location}</location>
</skill>`
  })

  return `<available_skills>
${skillBlocks.join('\n')}
</available_skills>`
}

/**
 * Build a skill snapshot from the table
 */
export async function buildTableSkillSnapshot(
  options: SkillLoadOptions = {},
  useFilesystemFallback = true
): Promise<SkillSnapshot> {
  try {
    // Load all skills including ineligible for the full picture
    const allSkills = await loadSkillsFromTable(
      { ...options, includeIneligible: true },
      useFilesystemFallback
    )

    // Get eligibility for each
    const result = await SkillsTable.findRows({
      limit: 1000,
    })

    const rowMap = new Map(
      result.rows.map((r) => [(r as unknown as SkillRow).name, r as unknown as SkillRow])
    )

    const skillsWithEligibility = allSkills.map((skill) => {
      const row = rowMap.get(skill.name)
      const eligibility = row
        ? checkTableSkillEligibility(row)
        : { eligible: true }

      return {
        name: skill.name,
        description: skill.description,
        eligible: eligibility.eligible,
        eligibility,
      }
    })

    const eligibleSkills = allSkills.filter((s) => {
      const row = rowMap.get(s.name)
      return row ? checkTableSkillEligibility(row).eligible : true
    })

    const prompt = formatTableSkillsForPrompt(eligibleSkills)

    return {
      prompt,
      skills: skillsWithEligibility,
      eligibleCount: eligibleSkills.length,
      totalCount: allSkills.length,
    }
  } catch (error) {
    if (useFilesystemFallback) {
      console.warn('Failed to build skill snapshot from table, falling back to filesystem:', error)
      return buildFsSkillSnapshot(options)
    }
    throw error
  }
}

/**
 * List all skills from the table with eligibility
 */
export async function listSkillsFromTable(
  options: SkillLoadOptions = {},
  useFilesystemFallback = true
): Promise<Array<{ skill: Skill; eligibility: SkillEligibility }>> {
  try {
    const skills = await loadSkillsFromTable(
      { ...options, includeIneligible: true },
      useFilesystemFallback
    )

    const result = await SkillsTable.findRows({
      limit: 1000,
    })

    const rowMap = new Map(
      result.rows.map((r) => [(r as unknown as SkillRow).name, r as unknown as SkillRow])
    )

    return skills.map((skill) => {
      const row = rowMap.get(skill.name)
      const eligibility = row
        ? checkTableSkillEligibility(row)
        : { eligible: true }

      return { skill, eligibility }
    })
  } catch (error) {
    if (useFilesystemFallback) {
      console.warn('Failed to list skills from table, falling back to filesystem:', error)
      const fsSkills = loadSkillsFromFilesystem({ ...options, includeIneligible: true })
      return fsSkills.map((skill) => ({
        skill,
        eligibility: checkFsSkillEligibility(skill),
      }))
    }
    throw error
  }
}
