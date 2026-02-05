/**
 * Skill Generation Tools - Tools for creating and managing skills
 *
 * These tools enable the agent to manage prompt-based skills in the SkillsTable.
 * For app automation scripts, see the app-automation tools.
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { SkillsTable, stringifyArray, parseJsonArray, type SkillRow } from '../../../tables/skills.js'

// ============ Skill Draft ============

const skillDraftInput = z.object({
  name: z.string().describe('Unique skill identifier (lowercase, hyphens)'),
  displayName: z.string().describe('Human-readable skill name'),
  description: z.string().describe('What this skill enables'),
  promptContent: z.string().describe('Markdown instructions for using this skill'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
  userInvocable: z.boolean().optional().default(false).describe('Can users invoke via /command'),
})

const skillDraftOutput = z.object({
  draft: z
    .object({
      name: z.string(),
      displayName: z.string(),
      description: z.string(),
      source: z.literal('discovered'),
      promptContent: z.string(),
      tags: z.string().optional(),
    })
    .describe('Draft skill row ready for upsert'),
  preview: z.string().describe('Human-readable preview'),
})

export const skillDraftToolDef: ToolDefinition = {
  name: 'skill_draft',
  groups: ['skill-gen'],
  description: 'Generate a skill draft for prompt-based skills',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_draft',
      description: `Generate a skill draft for a prompt-based skill.

Use this to create skills that provide instructions and knowledge to agents.
The draft can then be saved with skill_upsert.

The promptContent should include:
- What the skill enables
- How to use it
- Example code or commands
- Any limitations or requirements

NOTE: For executable app automation scripts, use automation_upsert instead.`,
      input: skillDraftInput,
      output: skillDraftOutput,
      handler: async (input) => {
        const draft = {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          source: 'discovered' as const,
          promptContent: input.promptContent,
          tags: stringifyArray(input.tags),
          version: 1,
          userInvocable: input.userInvocable ?? false,
          priority: 0,
        }

        const preview = `
# Skill Draft: ${input.displayName}

**ID:** ${input.name}
**User Invocable:** ${input.userInvocable ? 'Yes' : 'No'}

## Description
${input.description}

## Prompt Content
${input.promptContent.slice(0, 500)}${input.promptContent.length > 500 ? '...' : ''}
`.trim()

        return { draft, preview }
      },
    }),
}

// ============ Skill Upsert ============

const skillUpsertInput = z.object({
  name: z.string().describe('Unique skill identifier'),
  displayName: z.string().describe('Human-readable name'),
  description: z.string().describe('What this skill does'),
  source: z.enum(['seed', 'discovered', 'user']).default('discovered'),
  promptContent: z.string().describe('Markdown content for prompt'),
  requiresBins: z.array(z.string()).optional().describe('Required CLI binaries'),
  requiresEnvVars: z.array(z.string()).optional().describe('Required env vars'),
  requiresPlatform: z.array(z.string()).optional().describe('Required platforms'),
  installInstructions: z.unknown().optional().describe('Install instructions JSON'),
  tags: z.array(z.string()).optional(),
  userInvocable: z.boolean().optional().default(false),
  priority: z.number().optional().default(0),
  emoji: z.string().optional(),
})

const skillUpsertOutput = z.object({
  success: z.boolean(),
  action: z.enum(['inserted', 'updated']),
  skill: z.object({
    id: z.number(),
    name: z.string(),
  }),
})

export const skillUpsertToolDef: ToolDefinition = {
  name: 'skill_upsert',
  groups: ['skill-gen'],
  description: 'Insert or update a skill in the SkillsTable',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_upsert',
      description: `Insert or update a prompt-based skill in the SkillsTable.

If a skill with the same name exists, it will be updated.
Otherwise, a new skill will be created.

Use skill_draft first to generate and preview the skill content.

NOTE: For executable app automation scripts, use automation_upsert instead.`,
      input: skillUpsertInput,
      output: skillUpsertOutput,
      handler: async (input) => {
        const row = {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          source: input.source,
          promptContent: input.promptContent,
          requiresBins: stringifyArray(input.requiresBins),
          requiresEnvVars: stringifyArray(input.requiresEnvVars),
          requiresPlatform: stringifyArray(input.requiresPlatform),
          installInstructions: input.installInstructions
            ? JSON.stringify(input.installInstructions)
            : undefined,
          version: 1,
          tags: stringifyArray(input.tags),
          userInvocable: input.userInvocable ?? false,
          priority: input.priority ?? 0,
          emoji: input.emoji,
        }

        const result = await SkillsTable.upsertRows({
          rows: [row],
          keyColumn: 'name',
        })

        const inserted = result.inserted.length > 0
        const skill = inserted ? result.inserted[0] : result.updated[0]

        return {
          success: true,
          action: inserted ? ('inserted' as const) : ('updated' as const),
          skill: {
            id: skill.id as number,
            name: (skill as unknown as SkillRow).name,
          },
        }
      },
    }),
}

// ============ Skill Query ============

const skillQueryInput = z.object({
  query: z.string().optional().describe('Semantic search query'),
  name: z.string().optional().describe('Exact name match'),
  source: z.enum(['seed', 'discovered', 'user']).optional().describe('Filter by source'),
  limit: z.number().optional().default(10),
})

const skillQueryOutput = z.object({
  skills: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        displayName: z.string(),
        description: z.string(),
        source: z.string(),
        userInvocable: z.boolean(),
        similarity: z.number().optional(),
      })
    )
    .describe('Matching skills'),
  count: z.number(),
})

export const skillQueryToolDef: ToolDefinition = {
  name: 'skill_query',
  groups: ['skill-gen'],
  description: 'Search skills in the SkillsTable',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_query',
      description: `Search for skills in the SkillsTable.

Supports:
- Semantic search by query text
- Exact name lookup
- Filtering by source (seed/discovered/user)

Use this to find existing skills before creating duplicates.`,
      input: skillQueryInput,
      output: skillQueryOutput,
      handler: async (input) => {
        // Build filter
        const filter: Record<string, unknown> = {}
        if (input.name) filter.name = input.name
        if (input.source) filter.source = input.source

        const result = await SkillsTable.findRows({
          search: input.query,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          limit: input.limit,
        })

        const skills = result.rows.map((row) => {
          const r = row as unknown as SkillRow & { id: number; similarity?: number }
          return {
            id: r.id,
            name: r.name,
            displayName: r.displayName,
            description: r.description,
            source: r.source,
            userInvocable: r.userInvocable,
            similarity: r.similarity,
          }
        })

        return { skills, count: skills.length }
      },
    }),
}

// ============ Skill Get ============

const skillGetInput = z.object({
  name: z.string().describe('Skill name to retrieve'),
})

const skillGetOutput = z.object({
  found: z.boolean(),
  skill: z
    .object({
      id: z.number(),
      name: z.string(),
      displayName: z.string(),
      description: z.string(),
      source: z.string(),
      promptContent: z.string(),
      version: z.number(),
      userInvocable: z.boolean(),
    })
    .optional(),
})

export const skillGetToolDef: ToolDefinition = {
  name: 'skill_get',
  groups: ['skill-gen'],
  description: 'Get full details of a skill by name',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_get',
      description: `Get the full details of a skill by name.

Returns all fields including promptContent.
Use skill_query first to find skills if you don't know the exact name.`,
      input: skillGetInput,
      output: skillGetOutput,
      handler: async (input) => {
        const result = await SkillsTable.findRows({
          filter: { name: input.name },
          limit: 1,
        })

        if (result.rows.length === 0) {
          return { found: false }
        }

        const r = result.rows[0] as unknown as SkillRow & { id: number }
        return {
          found: true,
          skill: {
            id: r.id,
            name: r.name,
            displayName: r.displayName,
            description: r.description,
            source: r.source,
            promptContent: r.promptContent,
            version: r.version,
            userInvocable: r.userInvocable,
          },
        }
      },
    }),
}
