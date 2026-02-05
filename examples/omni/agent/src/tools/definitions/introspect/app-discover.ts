/**
 * App Discover Tool - Find running Electron/Chromium applications
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

const inputSchema = z.object({
  filter: z
    .enum(['all', 'electron', 'chromium'])
    .optional()
    .default('electron')
    .describe('Filter by app type'),
  name: z
    .string()
    .optional()
    .describe('Filter by app name (partial match, e.g., "cursor", "slack")'),
})

const appSchema = z.object({
  pid: z.number(),
  name: z.string(),
  path: z.string().optional(),
  bundleId: z.string().optional(),
  type: z.enum(['electron', 'chromium', 'native', 'unknown']),
  cdpPort: z.number().optional(),
  wsEndpoint: z.string().optional(),
  version: z.string().optional(),
})

const outputSchema = z.object({
  apps: z.array(appSchema).describe('List of discovered applications'),
  count: z.number().describe('Number of apps found'),
})

type Input = z.infer<typeof inputSchema>
type Output = z.infer<typeof outputSchema>

export const appDiscoverToolDef: ToolDefinition = {
  name: 'app_discover',
  groups: ['introspect'],
  description: 'Find running Electron and Chromium-based applications',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'app_discover',
      description: `Find running Electron and Chromium-based desktop applications on the local machine.

Use this to:
- List all running Electron apps (VS Code, Cursor, Slack, Discord, etc.)
- Find a specific app by name
- Discover apps that can be instrumented via CDP

Returns app info including PID, name, path, bundle ID, and any existing CDP debug ports.`,
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<Input, Output>('/introspect/apps', input, ctx.config)
      },
    }),
}
