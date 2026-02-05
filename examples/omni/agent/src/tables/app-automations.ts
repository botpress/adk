/**
 * App Automations Table - Executable automation scripts for desktop apps
 *
 * This table stores discovered automation scripts that can be executed
 * via the `node` binary to control desktop applications.
 *
 * The app-engineer agent discovers control points in apps (via CDP, Frida, etc.)
 * and saves reusable automation scripts here.
 */

import { Table, z } from '@botpress/runtime'

/**
 * Type of runtime injection method
 */
export const InjectionTypeEnum = z.enum(['cdp', 'frida', 'applescript', 'accessibility'])
export type InjectionType = z.infer<typeof InjectionTypeEnum>

/**
 * AppAutomationsTable - stores executable app automation scripts
 */
export const AppAutomationsTable = new Table({
  name: 'AppAutomationsTable',
  description: 'Executable automation scripts for desktop applications',
  columns: {
    // Identity
    name: {
      schema: z.string().describe('Unique automation identifier'),
      searchable: true,
    },
    displayName: {
      schema: z.string().describe('Human-readable name'),
      searchable: true,
    },
    description: {
      schema: z.string().describe('What this automation does'),
      searchable: true,
    },

    // Target app
    targetApp: {
      schema: z.string().describe('Target app bundle ID or process name'),
      searchable: true,
    },
    targetPlatform: {
      schema: z.string().optional().describe('Platform: darwin, linux, win32'),
      searchable: false,
    },

    // Discovery metadata
    discoveredAt: {
      schema: z.string().optional().describe('ISO timestamp of discovery'),
      searchable: false,
    },
    discoveryMethod: {
      schema: z.string().optional().describe('How it was discovered: webpack_traverse, export_enum, etc.'),
      searchable: true,
    },

    // Execution
    injectionType: {
      schema: InjectionTypeEnum.describe('Type of injection: cdp, frida, applescript, accessibility'),
      searchable: true,
    },
    scriptCode: {
      schema: z.string().describe('Executable script code (Node.js)'),
      searchable: false,
    },

    // Script metadata for execution
    targetSelectors: {
      schema: z.string().optional().describe('JSON: module paths, function names, selectors, etc.'),
      searchable: false,
    },
    inputSchema: {
      schema: z.string().optional().describe('JSON Schema for script input parameters'),
      searchable: false,
    },

    // Usage
    usageCount: {
      schema: z.number().default(0).describe('Number of times this automation was executed'),
      searchable: false,
    },
    lastUsedAt: {
      schema: z.string().optional().describe('ISO timestamp of last use'),
      searchable: false,
    },
    tags: {
      schema: z.string().optional().describe('JSON array of tags'),
      searchable: true,
    },
  },
  keyColumn: 'name',
})

/**
 * Type for an automation row input (what we insert)
 */
export type AppAutomationRowInput = {
  name: string
  displayName: string
  description: string
  targetApp: string
  targetPlatform?: string
  discoveredAt?: string
  discoveryMethod?: string
  injectionType: InjectionType
  scriptCode: string
  targetSelectors?: string
  inputSchema?: string
  usageCount?: number
  lastUsedAt?: string
  tags?: string
}

/**
 * Type for an automation row returned from the table
 */
export type AppAutomationRow = AppAutomationRowInput & {
  id: number
  createdAt: string
  updatedAt: string
  usageCount: number
}
