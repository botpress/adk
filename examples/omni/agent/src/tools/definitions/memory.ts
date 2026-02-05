import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

// Memory Read
const memoryReadInputSchema = z.object({
  key: z.string().optional().describe('Specific memory key to read. If omitted, returns all keys.'),
  namespace: z.string().optional().describe('Memory namespace (default: "default")'),
})

const memoryReadOutputSchema = z.object({
  value: z.unknown().optional().describe('The stored value for the key'),
  keys: z.array(z.string()).optional().describe('List of all keys (when no specific key requested)'),
  found: z.boolean().describe('Whether the key was found'),
})

type MemoryReadInput = z.infer<typeof memoryReadInputSchema>
type MemoryReadOutput = z.infer<typeof memoryReadOutputSchema>

export const memoryReadToolDef: ToolDefinition = {
  name: 'memory_read',
  groups: ['memory'],
  description: 'Read from persistent agent memory',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'memory_read',
      description:
        'Read from persistent agent memory. Memory persists across sessions. Use for retrieving stored preferences, context, and previous conversation state.',
      input: memoryReadInputSchema,
      output: memoryReadOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<MemoryReadInput, MemoryReadOutput>('/memory/read', input, ctx.config)
      },
    }),
}

// Memory Write
const memoryWriteInputSchema = z.object({
  key: z.string().describe('Memory key to write'),
  value: z.unknown().describe('Value to store (JSON-serializable)'),
  namespace: z.string().optional().describe('Memory namespace (default: "default")'),
})

const memoryWriteOutputSchema = z.object({
  key: z.string().describe('The key that was written'),
  success: z.boolean().describe('Whether the write was successful'),
  previousValue: z.unknown().optional().describe('The previous value (if any)'),
})

type MemoryWriteInput = z.infer<typeof memoryWriteInputSchema>
type MemoryWriteOutput = z.infer<typeof memoryWriteOutputSchema>

export const memoryWriteToolDef: ToolDefinition = {
  name: 'memory_write',
  groups: ['memory'],
  description: 'Write to persistent agent memory',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'memory_write',
      description:
        'Write to persistent agent memory. Memory persists across sessions. Use for storing preferences, learned context, and conversation state that should be remembered.',
      input: memoryWriteInputSchema,
      output: memoryWriteOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<MemoryWriteInput, MemoryWriteOutput>('/memory/write', input, ctx.config)
      },
    }),
}
