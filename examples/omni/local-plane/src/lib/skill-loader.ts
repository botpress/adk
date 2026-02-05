/**
 * Skill loader - loads and parses SKILL.md files
 *
 * This is a copy of the parsing logic from agent/src/skills/loader.ts
 * for use in the local-plane to serve skills via API.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { join, basename } from 'path'

/**
 * Skill requirements specification
 */
export type SkillRequirements = {
  bins?: string[]
  anyBins?: string[]
  envVars?: string[]
  platform?: string | string[]
}

/**
 * Omni-specific skill metadata
 */
export type SkillMetadata = {
  emoji?: string
  requires?: SkillRequirements
  install?: unknown[]
  setup?: {
    commands?: string[]
    interactive?: boolean
    instructions?: string
  }
  primaryEnv?: 'local' | 'remote' | 'both'
}

/**
 * Parsed frontmatter from a SKILL.md file
 */
export type SkillFrontmatter = {
  name?: string
  description?: string
  homepage?: string
  metadata?: {
    omni?: SkillMetadata
  }
  tags?: string[]
  userInvocable?: boolean
  includeInPrompt?: boolean
  priority?: number
}

/**
 * A loaded skill (simplified for API response)
 */
export type LoadedSkill = {
  name: string
  description?: string
  filePath: string
  baseDir: string
  frontmatter: SkillFrontmatter
  metadata: SkillMetadata
  content: string
  rawContent: string
  source: string
}

/**
 * Skill data for API response (flattened for table insertion)
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
function loadSkillFromDir(dir: string, source: string): LoadedSkill | null {
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
export function loadSkillsFromDir(skillsDir: string, source: string): LoadedSkill[] {
  if (!existsSync(skillsDir)) {
    return []
  }

  const skills: LoadedSkill[] = []

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
 * Helper to stringify array fields for storage
 */
function stringifyArray<T>(arr: T[] | undefined): string | undefined {
  if (!arr || arr.length === 0) return undefined
  return JSON.stringify(arr)
}

/**
 * Convert a loaded skill to SkillData for API response
 */
export function skillToData(skill: LoadedSkill): SkillData {
  const metadata = skill.metadata

  return {
    name: skill.name,
    displayName: skill.frontmatter.name || skill.name,
    description: skill.description || skill.name,
    promptContent: skill.content,
    requiresBins: stringifyArray(metadata.requires?.bins),
    requiresEnvVars: stringifyArray(metadata.requires?.envVars),
    requiresPlatform: stringifyArray(
      metadata.requires?.platform
        ? Array.isArray(metadata.requires.platform)
          ? metadata.requires.platform
          : [metadata.requires.platform]
        : undefined
    ),
    installInstructions: metadata.install ? JSON.stringify(metadata.install) : undefined,
    version: 1,
    tags: stringifyArray(skill.frontmatter.tags),
    userInvocable: skill.frontmatter.userInvocable ?? false,
    priority: skill.frontmatter.priority ?? 0,
    emoji: metadata.emoji,
  }
}

/**
 * Load all skills from a directory and convert to SkillData
 */
export function loadSkillsAsData(skillsDir: string): SkillData[] {
  const skills = loadSkillsFromDir(skillsDir, 'workspace')
  return skills.map(skillToData)
}
