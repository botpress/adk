import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const inputSchema = z.object({
  path: z.string().describe('Absolute or relative path to the file to read'),
  encoding: z.enum(['utf8', 'base64']).optional().describe('File encoding (default: utf8)'),
  maxSize: z.number().optional().describe('Maximum file size in bytes to read (default: 1MB)'),
})

const outputSchema = z.object({
  content: z.string().describe('Content of the file'),
  path: z.string().describe('Absolute path of the file'),
  size: z.number().describe('File size in bytes'),
  truncated: z.boolean().describe('Whether the content was truncated due to size'),
})

type FileReadInput = z.infer<typeof inputSchema>
type FileReadOutput = z.infer<typeof outputSchema>

export const fileReadToolDef: ToolDefinition = {
  name: 'file_read',
  groups: ['local', 'filesystem'],
  description: 'Read contents of a file from the local filesystem',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'file_read',
      description:
        'Read the contents of a file from the local filesystem. Supports text and binary files (as base64). Use for reading source code, configuration files, and documents.',
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<FileReadInput, FileReadOutput>('/file/read', input, ctx.config)
      },
    }),
}
