import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const inputSchema = z.object({
  files: z
    .array(z.string())
    .optional()
    .describe('Specific files to load (e.g., ["SOUL.md", "AGENTS.md"]). If empty, loads defaults.'),
  includeMemory: z.boolean().optional().describe('Include memory files in the context (default: false)'),
})

const outputSchema = z.object({
  soul: z.string().optional().describe('Content of SOUL.md (agent personality)'),
  agents: z.string().optional().describe('Content of AGENTS.md (multi-agent instructions)'),
  memory: z.string().optional().describe('Content of memory files'),
  customFiles: z.record(z.string()).optional().describe('Custom files loaded by path'),
  loadedCount: z.number().describe('Number of files successfully loaded'),
})

type ContextInput = z.infer<typeof inputSchema>
type ContextOutput = z.infer<typeof outputSchema>

export const contextLoadToolDef: ToolDefinition = {
  name: 'context_load',
  groups: ['memory'],
  description: 'Load context files (SOUL.md, AGENTS.md, memory) for agent instructions',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'context_load',
      description:
        'Load context files that define agent personality and behavior. Includes SOUL.md (personality), AGENTS.md (multi-agent instructions), and optional memory files. Call this at the start of a session to load agent context.',
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<ContextInput, ContextOutput>('/context/load', input, ctx.config)
      },
    }),
}
