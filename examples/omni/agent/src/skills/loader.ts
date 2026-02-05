/**
 * Skill loader - loads and parses SKILL.md files
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, basename } from 'path'
import type {
  Skill,
  SkillFrontmatter,
  SkillMetadata,
  SkillLoadOptions,
  SkillSnapshot,
  SkillEligibility,
  SkillRequirements,
  InstallInstruction,
} from './types.js'
import { checkBinaryExists, getCurrentPlatform } from './utils.js'

/**
 * Parse YAML-like frontmatter from markdown content
 * Handles both YAML and JSON frontmatter
 */
function parseFrontmatter(content: string): { frontmatter: SkillFrontmatter; body: string } {
  const lines = content.split('\n')

  // Check for frontmatter delimiter
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: {}, body: content }
  }

  // Find closing delimiter
  let endIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === '---') {
      endIndex = i
      break
    }
  }

  if (endIndex === -1) {
    return { frontmatter: {}, body: content }
  }

  const frontmatterText = lines.slice(1, endIndex).join('\n')
  const body = lines.slice(endIndex + 1).join('\n').trim()

  try {
    // Try parsing as JSON first (for metadata blocks)
    const parsed = parseYamlLike(frontmatterText)
    return { frontmatter: parsed as SkillFrontmatter, body }
  } catch {
    return { frontmatter: {}, body }
  }
}

/**
 * Simple YAML-like parser for frontmatter
 * Handles basic key: value pairs and JSON embedded in metadata
 */
function parseYamlLike(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = text.split('\n')

  let currentKey = ''
  let jsonBuffer = ''
  let inJson = false
  let braceCount = 0

  for (const line of lines) {
    const trimmed = line.trim()

    if (inJson) {
      jsonBuffer += line + '\n'
      braceCount += (line.match(/\{/g) || []).length
      braceCount -= (line.match(/\}/g) || []).length

      if (braceCount === 0) {
        try {
          result[currentKey] = JSON.parse(jsonBuffer.trim())
        } catch {
          result[currentKey] = jsonBuffer.trim()
        }
        inJson = false
        jsonBuffer = ''
      }
      continue
    }

    // Check for key: value
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim()
      const value = trimmed.slice(colonIndex + 1).trim()

      if (value.startsWith('{') || value.startsWith('[')) {
        // Start of JSON block
        currentKey = key
        jsonBuffer = value + '\n'
        braceCount = (value.match(/\{/g) || []).length + (value.match(/\[/g) || []).length
        braceCount -= (value.match(/\}/g) || []).length + (value.match(/\]/g) || []).length

        if (braceCount === 0) {
          try {
            result[key] = JSON.parse(value)
          } catch {
            result[key] = value
          }
        } else {
          inJson = true
        }
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.slice(1, -1)
      } else if (value === 'true') {
        result[key] = true
      } else if (value === 'false') {
        result[key] = false
      } else if (!isNaN(Number(value)) && value !== '') {
        result[key] = Number(value)
      } else {
        result[key] = value
      }
    }
  }

  return result
}

/**
 * Resolve skill metadata with defaults
 */
function resolveMetadata(frontmatter: SkillFrontmatter): SkillMetadata {
  // Handle both "omni" and "openclaw" metadata keys for compatibility
  const raw = frontmatter.metadata?.omni ?? (frontmatter.metadata as Record<string, unknown>)?.openclaw ?? {}
  return raw as SkillMetadata
}

/**
 * Load a single skill from a directory
 */
function loadSkillFromDir(dir: string, source: string): Skill | null {
  const skillFile = join(dir, 'SKILL.md')

  if (!existsSync(skillFile)) {
    return null
  }

  try {
    const rawContent = readFileSync(skillFile, 'utf-8')
    const { frontmatter, body } = parseFrontmatter(rawContent)

    const name = frontmatter.name ?? basename(dir)
    const metadata = resolveMetadata(frontmatter)

    return {
      name,
      description: frontmatter.description,
      filePath: skillFile,
      baseDir: dir,
      frontmatter,
      metadata,
      content: body,
      rawContent,
      source,
    }
  } catch {
    return null
  }
}

/**
 * Load skills from a directory containing skill subdirectories
 */
export function loadSkillsFromDir(skillsDir: string, source: string): Skill[] {
  if (!existsSync(skillsDir)) {
    return []
  }

  const skills: Skill[] = []

  try {
    const entries = readdirSync(skillsDir)

    for (const entry of entries) {
      const entryPath = join(skillsDir, entry)
      const stat = statSync(entryPath)

      if (stat.isDirectory()) {
        const skill = loadSkillFromDir(entryPath, source)
        if (skill) {
          skills.push(skill)
        }
      }
    }
  } catch {
    // Directory read failed
  }

  return skills
}

/**
 * Check if a skill's requirements are met
 */
export function checkSkillEligibility(skill: Skill): SkillEligibility {
  const requires = skill.metadata.requires
  const result: SkillEligibility = { eligible: true }

  if (!requires) {
    return result
  }

  // Check required binaries (all must exist)
  if (requires.bins && requires.bins.length > 0) {
    const missing = requires.bins.filter((bin) => !checkBinaryExists(bin))
    if (missing.length > 0) {
      result.eligible = false
      result.missingBins = missing
    }
  }

  // Check anyBins (at least one must exist)
  if (requires.anyBins && requires.anyBins.length > 0) {
    const hasAny = requires.anyBins.some((bin) => checkBinaryExists(bin))
    if (!hasAny) {
      result.eligible = false
      result.missingBins = [...(result.missingBins ?? []), ...requires.anyBins]
    }
  }

  // Check environment variables
  if (requires.envVars && requires.envVars.length > 0) {
    const missing = requires.envVars.filter((v) => !process.env[v])
    if (missing.length > 0) {
      result.eligible = false
      result.missingEnvVars = missing
    }
  }

  // Check platform
  if (requires.platform) {
    const current = getCurrentPlatform()
    const allowed = Array.isArray(requires.platform) ? requires.platform : [requires.platform]
    if (!allowed.includes(current)) {
      result.eligible = false
      result.platformMismatch = true
    }
  }

  // Find available install options for missing bins
  if (result.missingBins && result.missingBins.length > 0 && skill.metadata.install) {
    result.availableInstalls = skill.metadata.install.filter((inst) =>
      inst.bins.some((bin) => result.missingBins?.includes(bin))
    )
  }

  return result
}

/**
 * Load all skills from multiple directories
 */
export function loadSkills(options: SkillLoadOptions = {}): Skill[] {
  const { skillDirs = [], skillFilter, checkRequirements = false, includeIneligible = false } = options

  const allSkills: Map<string, Skill> = new Map()

  // Load from all directories (later ones override earlier)
  for (const dir of skillDirs) {
    const skills = loadSkillsFromDir(dir, dir)
    for (const skill of skills) {
      allSkills.set(skill.name, skill)
    }
  }

  let skills = Array.from(allSkills.values())

  // Apply name filter
  if (skillFilter && skillFilter.length > 0) {
    skills = skills.filter((s) => skillFilter.includes(s.name))
  }

  // Check requirements if requested
  if (checkRequirements && !includeIneligible) {
    skills = skills.filter((s) => checkSkillEligibility(s).eligible)
  }

  // Sort by priority (higher first), then by name
  skills.sort((a, b) => {
    const priorityA = a.frontmatter.priority ?? 0
    const priorityB = b.frontmatter.priority ?? 0
    if (priorityB !== priorityA) {
      return priorityB - priorityA
    }
    return a.name.localeCompare(b.name)
  })

  return skills
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Format skills as compact XML list (OpenClaw style)
 *
 * This produces a token-efficient listing where the agent reads
 * the full SKILL.md via file_read when a skill is selected.
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  const promptSkills = skills.filter((s) => s.frontmatter.includeInPrompt !== false)

  if (promptSkills.length === 0) {
    return ''
  }

  const skillBlocks = promptSkills.map((skill) => {
    const name = skill.name
    const description = escapeXml(skill.description || skill.name)
    const location = skill.filePath
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
 * Build a skill snapshot for an agent
 */
export function buildSkillSnapshot(options: SkillLoadOptions = {}): SkillSnapshot {
  const skills = loadSkills({ ...options, includeIneligible: true })

  const skillsWithEligibility = skills.map((skill) => {
    const eligibility = checkSkillEligibility(skill)
    return {
      name: skill.name,
      description: skill.description,
      eligible: eligibility.eligible,
      eligibility,
    }
  })

  const eligibleSkills = skills.filter((s) => checkSkillEligibility(s).eligible)
  const prompt = formatSkillsForPrompt(eligibleSkills)

  return {
    prompt,
    skills: skillsWithEligibility,
    eligibleCount: eligibleSkills.length,
    totalCount: skills.length,
  }
}

/**
 * Get a specific skill by name
 */
export function getSkill(name: string, options: SkillLoadOptions = {}): Skill | undefined {
  const skills = loadSkills({ ...options, skillFilter: [name] })
  return skills[0]
}

/**
 * List all available skills with their eligibility
 */
export function listSkills(
  options: SkillLoadOptions = {}
): Array<{ skill: Skill; eligibility: SkillEligibility }> {
  const skills = loadSkills({ ...options, includeIneligible: true })
  return skills.map((skill) => ({
    skill,
    eligibility: checkSkillEligibility(skill),
  }))
}
