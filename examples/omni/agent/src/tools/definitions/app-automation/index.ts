/**
 * App Automation Tools - Tools for managing executable app automation scripts
 *
 * These tools enable the app-engineer agent to save and execute reusable
 * automation scripts for desktop applications.
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { AppAutomationsTable, type AppAutomationRow } from '../../../tables/app-automations.js'

// ============ Automation Upsert ============

const automationUpsertInput = z.object({
  name: z.string().describe('Unique automation identifier (lowercase, hyphens)'),
  displayName: z.string().describe('Human-readable name'),
  description: z.string().describe('What this automation does'),
  targetApp: z.string().describe('Target app bundle ID or process name'),
  targetPlatform: z.string().optional().describe('Platform: darwin, linux, win32'),
  discoveryMethod: z.string().optional().describe('How it was discovered: webpack_traverse, export_enum, etc.'),
  injectionType: z.enum(['cdp', 'frida', 'applescript', 'accessibility']).describe('Type of injection'),
  scriptCode: z.string().describe('Executable Node.js script code'),
  targetSelectors: z.record(z.string()).optional().describe('Module paths, function names, selectors, etc.'),
  inputSchema: z.unknown().optional().describe('JSON Schema for script input parameters'),
  tags: z.array(z.string()).optional().describe('Tags for categorization'),
})

const automationUpsertOutput = z.object({
  success: z.boolean(),
  action: z.enum(['inserted', 'updated']),
  automation: z.object({
    id: z.number(),
    name: z.string(),
  }),
})

export const automationUpsertToolDef: ToolDefinition = {
  name: 'automation_upsert',
  groups: ['app-automation'],
  description: 'Save an executable app automation script to the database',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'automation_upsert',
      description: `Save an executable Node.js automation script to the AppAutomationsTable.

The script should be a complete, runnable Node.js file that can be executed via:
  node <script.js> [args]

The script should:
- Use CDP (chrome-remote-interface) for Electron apps
- Use Frida (frida) for native apps
- Accept command-line arguments for parameters
- Output results to stdout

Example CDP script structure:
  #!/usr/bin/env node
  const CDP = require('chrome-remote-interface');
  async function main() { ... }
  main().catch(console.error);

Example Frida script structure:
  #!/usr/bin/env node
  const frida = require('frida');
  async function main() { ... }
  main().catch(console.error);`,
      input: automationUpsertInput,
      output: automationUpsertOutput,
      handler: async (input) => {
        const row = {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          targetApp: input.targetApp,
          targetPlatform: input.targetPlatform,
          discoveredAt: new Date().toISOString(),
          discoveryMethod: input.discoveryMethod,
          injectionType: input.injectionType,
          scriptCode: input.scriptCode,
          targetSelectors: input.targetSelectors ? JSON.stringify(input.targetSelectors) : undefined,
          inputSchema: input.inputSchema ? JSON.stringify(input.inputSchema) : undefined,
          tags: input.tags ? JSON.stringify(input.tags) : undefined,
        }

        const result = await AppAutomationsTable.upsertRows({
          rows: [row],
          keyColumn: 'name',
        })

        const inserted = result.inserted.length > 0
        const automation = inserted ? result.inserted[0] : result.updated[0]

        return {
          success: true,
          action: inserted ? ('inserted' as const) : ('updated' as const),
          automation: {
            id: automation.id as number,
            name: (automation as unknown as AppAutomationRow).name,
          },
        }
      },
    }),
}

// ============ Automation Query ============

const automationQueryInput = z.object({
  query: z.string().optional().describe('Semantic search query'),
  name: z.string().optional().describe('Exact name match'),
  targetApp: z.string().optional().describe('Filter by target app'),
  injectionType: z.enum(['cdp', 'frida', 'applescript', 'accessibility']).optional().describe('Filter by injection type'),
  limit: z.number().optional().default(10),
})

const automationQueryOutput = z.object({
  automations: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        displayName: z.string(),
        description: z.string(),
        targetApp: z.string(),
        injectionType: z.string(),
        usageCount: z.number(),
        similarity: z.number().optional(),
      })
    )
    .describe('Matching automations'),
  count: z.number(),
})

export const automationQueryToolDef: ToolDefinition = {
  name: 'automation_query',
  groups: ['app-automation'],
  description: 'Search app automations in the database',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'automation_query',
      description: `Search for app automations in the AppAutomationsTable.

Supports:
- Semantic search by query text
- Exact name lookup
- Filtering by target app
- Filtering by injection type (cdp, frida, applescript, accessibility)

Use this to find existing automations before creating duplicates.`,
      input: automationQueryInput,
      output: automationQueryOutput,
      handler: async (input) => {
        const filter: Record<string, unknown> = {}
        if (input.name) filter.name = input.name
        if (input.targetApp) filter.targetApp = input.targetApp
        if (input.injectionType) filter.injectionType = input.injectionType

        const result = await AppAutomationsTable.findRows({
          search: input.query,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          limit: input.limit,
        })

        const automations = result.rows.map((row) => {
          const r = row as unknown as AppAutomationRow & { id: number; similarity?: number }
          return {
            id: r.id,
            name: r.name,
            displayName: r.displayName,
            description: r.description,
            targetApp: r.targetApp,
            injectionType: r.injectionType,
            usageCount: r.usageCount,
            similarity: r.similarity,
          }
        })

        return { automations, count: automations.length }
      },
    }),
}

// ============ Automation Get ============

const automationGetInput = z.object({
  name: z.string().describe('Automation name to retrieve'),
})

const automationGetOutput = z.object({
  found: z.boolean(),
  automation: z
    .object({
      id: z.number(),
      name: z.string(),
      displayName: z.string(),
      description: z.string(),
      targetApp: z.string(),
      injectionType: z.string(),
      scriptCode: z.string(),
      targetSelectors: z.record(z.string()).optional(),
      inputSchema: z.unknown().optional(),
      usageCount: z.number(),
    })
    .optional(),
})

export const automationGetToolDef: ToolDefinition = {
  name: 'automation_get',
  groups: ['app-automation'],
  description: 'Get full details of an automation by name',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'automation_get',
      description: `Get the full details of an app automation by name.

Returns all fields including the executable scriptCode.
Use automation_query first to find automations if you don't know the exact name.`,
      input: automationGetInput,
      output: automationGetOutput,
      handler: async (input) => {
        const result = await AppAutomationsTable.findRows({
          filter: { name: input.name },
          limit: 1,
        })

        if (result.rows.length === 0) {
          return { found: false }
        }

        const r = result.rows[0] as unknown as AppAutomationRow & { id: number }
        return {
          found: true,
          automation: {
            id: r.id,
            name: r.name,
            displayName: r.displayName,
            description: r.description,
            targetApp: r.targetApp,
            injectionType: r.injectionType,
            scriptCode: r.scriptCode,
            targetSelectors: r.targetSelectors ? JSON.parse(r.targetSelectors) : undefined,
            inputSchema: r.inputSchema ? JSON.parse(r.inputSchema) : undefined,
            usageCount: r.usageCount,
          },
        }
      },
    }),
}

// ============ Automation Run ============

const automationRunInput = z.object({
  name: z.string().describe('Automation name to run'),
  args: z.array(z.string()).optional().describe('Command-line arguments to pass to the script'),
  timeout: z.number().optional().default(30000).describe('Timeout in milliseconds'),
})

const automationRunOutput = z.object({
  success: z.boolean(),
  exitCode: z.number().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
})

export const automationRunToolDef: ToolDefinition = {
  name: 'automation_run',
  groups: ['app-automation'],
  description: 'Execute a saved app automation script',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'automation_run',
      description: `Execute a saved app automation script via the node binary.

The script is retrieved from the database and executed with:
  node -e "<scriptCode>" [args]

This increments the usageCount and updates lastUsedAt.

NOTE: This requires the local plane to be running and have node available.`,
      input: automationRunInput,
      output: automationRunOutput,
      handler: async (input) => {
        // Get the automation
        const result = await AppAutomationsTable.findRows({
          filter: { name: input.name },
          limit: 1,
        })

        if (result.rows.length === 0) {
          return {
            success: false,
            error: `Automation '${input.name}' not found`,
          }
        }

        const automation = result.rows[0] as unknown as AppAutomationRow

        // Check local plane config
        const { localPlaneUrl, localPlaneToken } = ctx.config
        if (!localPlaneUrl || !localPlaneToken) {
          return {
            success: false,
            error: 'Local plane not configured',
          }
        }

        try {
          // Execute via local plane bash endpoint
          const args = input.args?.join(' ') || ''
          const command = `node -e ${JSON.stringify(automation.scriptCode)} ${args}`

          const response = await fetch(`${localPlaneUrl}/local/bash`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localPlaneToken}`,
            },
            body: JSON.stringify({
              command,
              timeout: input.timeout,
            }),
          })

          const data = (await response.json()) as {
            success: boolean
            exitCode?: number
            stdout?: string
            stderr?: string
            error?: string
          }

          // Update usage stats
          if (data.success) {
            await AppAutomationsTable.updateRows({
              filter: { name: input.name },
              set: {
                usageCount: automation.usageCount + 1,
                lastUsedAt: new Date().toISOString(),
              },
            })
          }

          return {
            success: data.success,
            exitCode: data.exitCode,
            stdout: data.stdout,
            stderr: data.stderr,
            error: data.error,
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during execution',
          }
        }
      },
    }),
}
