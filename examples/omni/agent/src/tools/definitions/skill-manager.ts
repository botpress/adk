import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import {
  listSkills,
  getSkill,
  checkSkillEligibility,
  installSkillDependencies,
  runSkillSetup,
  setupSkill,
  buildSkillSnapshot,
} from '../../skills/index.js'
import type { SkillLoadOptions } from '../../skills/types.js'

// =============================================================================
// Skill List Tool
// =============================================================================

const skillListInputSchema = z.object({
  includeIneligible: z.boolean().optional().describe('Include skills that cannot run due to missing dependencies'),
  skillDirs: z.array(z.string()).optional().describe('Directories to load skills from'),
})

const skillListOutputSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      eligible: z.boolean(),
      missingBins: z.array(z.string()).optional(),
      hasInstallOptions: z.boolean(),
    })
  ),
  eligibleCount: z.number(),
  totalCount: z.number(),
})

type SkillListInput = z.infer<typeof skillListInputSchema>
type SkillListOutput = z.infer<typeof skillListOutputSchema>

export const skillListToolDef: ToolDefinition = {
  name: 'skill_list',
  groups: ['skills'],
  description: 'List available skills and their eligibility status',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_list',
      description:
        'List all available skills with their eligibility status. Shows which skills are ready to use and which need dependencies installed.',
      input: skillListInputSchema,
      output: skillListOutputSchema,
      handler: async (input): Promise<SkillListOutput> => {
        const options: SkillLoadOptions = {
          skillDirs: input.skillDirs ?? [ctx.config.workspacePath ? `${ctx.config.workspacePath}/skills` : './skills'],
          includeIneligible: input.includeIneligible ?? true,
        }

        const results = listSkills(options)

        const skills = results.map(({ skill, eligibility }) => ({
          name: skill.name,
          description: skill.description,
          eligible: eligibility.eligible,
          missingBins: eligibility.missingBins,
          hasInstallOptions: (skill.metadata.install?.length ?? 0) > 0,
        }))

        return {
          skills,
          eligibleCount: skills.filter((s) => s.eligible).length,
          totalCount: skills.length,
        }
      },
    }),
}

// =============================================================================
// Skill Info Tool
// =============================================================================

const skillInfoInputSchema = z.object({
  name: z.string().describe('Name of the skill to get info about'),
  skillDirs: z.array(z.string()).optional().describe('Directories to load skills from'),
})

const skillInfoOutputSchema = z.object({
  found: z.boolean(),
  name: z.string().optional(),
  description: z.string().optional(),
  homepage: z.string().optional(),
  eligible: z.boolean().optional(),
  missingBins: z.array(z.string()).optional(),
  missingEnvVars: z.array(z.string()).optional(),
  installOptions: z
    .array(
      z.object({
        id: z.string(),
        kind: z.string(),
        label: z.string(),
      })
    )
    .optional(),
  setupRequired: z.boolean().optional(),
  setupInteractive: z.boolean().optional(),
  content: z.string().optional(),
})

type SkillInfoInput = z.infer<typeof skillInfoInputSchema>
type SkillInfoOutput = z.infer<typeof skillInfoOutputSchema>

export const skillInfoToolDef: ToolDefinition = {
  name: 'skill_info',
  groups: ['skills'],
  description: 'Get detailed information about a specific skill',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_info',
      description:
        'Get detailed information about a skill including its dependencies, install options, and setup requirements.',
      input: skillInfoInputSchema,
      output: skillInfoOutputSchema,
      handler: async (input): Promise<SkillInfoOutput> => {
        const options: SkillLoadOptions = {
          skillDirs: input.skillDirs ?? [ctx.config.workspacePath ? `${ctx.config.workspacePath}/skills` : './skills'],
        }

        const skill = getSkill(input.name, options)

        if (!skill) {
          return { found: false }
        }

        const eligibility = checkSkillEligibility(skill)

        return {
          found: true,
          name: skill.name,
          description: skill.description,
          homepage: skill.frontmatter.homepage,
          eligible: eligibility.eligible,
          missingBins: eligibility.missingBins,
          missingEnvVars: eligibility.missingEnvVars,
          installOptions: skill.metadata.install?.map((inst) => ({
            id: inst.id,
            kind: inst.kind,
            label: inst.label,
          })),
          setupRequired: !!skill.metadata.setup,
          setupInteractive: skill.metadata.setup?.interactive,
          content: skill.content,
        }
      },
    }),
}

// =============================================================================
// Skill Install Tool
// =============================================================================

const skillInstallInputSchema = z.object({
  name: z.string().describe('Name of the skill to install dependencies for'),
  installId: z.string().optional().describe('Specific install option ID to use (uses best available if not specified)'),
  skillDirs: z.array(z.string()).optional().describe('Directories to load skills from'),
})

const skillInstallOutputSchema = z.object({
  success: z.boolean(),
  skillName: z.string(),
  method: z.string().optional(),
  output: z.string().optional(),
  error: z.string().optional(),
  installedBins: z.array(z.string()).optional(),
})

type SkillInstallInput = z.infer<typeof skillInstallInputSchema>
type SkillInstallOutput = z.infer<typeof skillInstallOutputSchema>

export const skillInstallToolDef: ToolDefinition = {
  name: 'skill_install',
  groups: ['skills'],
  description: 'Install dependencies for a skill',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_install',
      description:
        'Install the dependencies required for a skill using the best available package manager (brew, apt, go, npm, etc.).',
      input: skillInstallInputSchema,
      output: skillInstallOutputSchema,
      handler: async (input): Promise<SkillInstallOutput> => {
        const options: SkillLoadOptions = {
          skillDirs: input.skillDirs ?? [ctx.config.workspacePath ? `${ctx.config.workspacePath}/skills` : './skills'],
        }

        const skill = getSkill(input.name, options)

        if (!skill) {
          return {
            success: false,
            skillName: input.name,
            error: `Skill "${input.name}" not found`,
          }
        }

        // Check if skill already eligible
        const eligibility = checkSkillEligibility(skill)
        if (eligibility.eligible) {
          return {
            success: true,
            skillName: skill.name,
            output: 'Skill dependencies already installed',
          }
        }

        // Install dependencies
        const result = await installSkillDependencies(skill)

        if (!result) {
          return {
            success: false,
            skillName: skill.name,
            error: 'No install instructions available for this skill',
          }
        }

        return {
          success: result.success,
          skillName: skill.name,
          method: `${result.instruction.kind}: ${result.instruction.label}`,
          output: result.output,
          error: result.error,
          installedBins: result.installedBins,
        }
      },
    }),
}

// =============================================================================
// Skill Setup Tool
// =============================================================================

const skillSetupInputSchema = z.object({
  name: z.string().describe('Name of the skill to setup'),
  installFirst: z.boolean().optional().describe('Install dependencies before setup (default: true)'),
  skillDirs: z.array(z.string()).optional().describe('Directories to load skills from'),
})

const skillSetupOutputSchema = z.object({
  success: z.boolean(),
  skillName: z.string(),
  installResult: z
    .object({
      success: z.boolean(),
      method: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
  setupResult: z.object({
    success: z.boolean(),
    output: z.string().optional(),
    error: z.string().optional(),
    needsInteractive: z.boolean().optional(),
    interactiveInstructions: z.string().optional(),
  }),
})

type SkillSetupInput = z.infer<typeof skillSetupInputSchema>
type SkillSetupOutput = z.infer<typeof skillSetupOutputSchema>

export const skillSetupToolDef: ToolDefinition = {
  name: 'skill_setup',
  groups: ['skills'],
  description: 'Install and setup a skill (full setup workflow)',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_setup',
      description:
        'Run the full setup workflow for a skill: install dependencies and run any setup commands. Reports if interactive setup is needed.',
      input: skillSetupInputSchema,
      output: skillSetupOutputSchema,
      handler: async (input): Promise<SkillSetupOutput> => {
        const options: SkillLoadOptions = {
          skillDirs: input.skillDirs ?? [ctx.config.workspacePath ? `${ctx.config.workspacePath}/skills` : './skills'],
        }

        const skill = getSkill(input.name, options)

        if (!skill) {
          return {
            success: false,
            skillName: input.name,
            setupResult: {
              success: false,
              error: `Skill "${input.name}" not found`,
            },
          }
        }

        const { install, setup } = await setupSkill(skill)

        return {
          success: setup.success && (install?.success ?? true),
          skillName: skill.name,
          installResult: install
            ? {
                success: install.success,
                method: `${install.instruction.kind}: ${install.instruction.label}`,
                error: install.error,
              }
            : undefined,
          setupResult: {
            success: setup.success,
            output: setup.output,
            error: setup.error,
            needsInteractive: setup.needsInteractive,
            interactiveInstructions: setup.interactiveInstructions,
          },
        }
      },
    }),
}

// =============================================================================
// Skill Prompt Tool (load skills into context)
// =============================================================================

const skillPromptInputSchema = z.object({
  skillFilter: z.array(z.string()).optional().describe('Only include these skills'),
  checkRequirements: z.boolean().optional().describe('Only include eligible skills (default: true)'),
  skillDirs: z.array(z.string()).optional().describe('Directories to load skills from'),
})

const skillPromptOutputSchema = z.object({
  prompt: z.string().describe('Formatted skill content for injection into instructions'),
  eligibleCount: z.number(),
  totalCount: z.number(),
  skills: z.array(
    z.object({
      name: z.string(),
      eligible: z.boolean(),
    })
  ),
})

type SkillPromptInput = z.infer<typeof skillPromptInputSchema>
type SkillPromptOutput = z.infer<typeof skillPromptOutputSchema>

export const skillPromptToolDef: ToolDefinition = {
  name: 'skill_prompt',
  groups: ['skills'],
  description: 'Load skills and generate a prompt for the agent',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'skill_prompt',
      description:
        'Load eligible skills and return formatted content for injection into agent instructions. Use this to dynamically add skill knowledge to the conversation.',
      input: skillPromptInputSchema,
      output: skillPromptOutputSchema,
      handler: async (input): Promise<SkillPromptOutput> => {
        const options: SkillLoadOptions = {
          skillDirs: input.skillDirs ?? [ctx.config.workspacePath ? `${ctx.config.workspacePath}/skills` : './skills'],
          skillFilter: input.skillFilter,
          checkRequirements: input.checkRequirements ?? true,
        }

        const snapshot = buildSkillSnapshot(options)

        return {
          prompt: snapshot.prompt,
          eligibleCount: snapshot.eligibleCount,
          totalCount: snapshot.totalCount,
          skills: snapshot.skills.map((s) => ({
            name: s.name,
            eligible: s.eligible,
          })),
        }
      },
    }),
}
