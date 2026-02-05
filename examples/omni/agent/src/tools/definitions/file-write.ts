import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const inputSchema = z.object({
  path: z.string().describe('Absolute or relative path to write the file'),
  content: z.string().describe('Content to write to the file'),
  encoding: z.enum(['utf8', 'base64']).optional().describe('Content encoding (default: utf8)'),
  createDirs: z.boolean().optional().describe('Create parent directories if they do not exist (default: true)'),
  overwrite: z.boolean().optional().describe('Overwrite existing file (default: true)'),
})

const outputSchema = z.object({
  path: z.string().describe('Absolute path of the written file'),
  size: z.number().describe('Size of the written file in bytes'),
  created: z.boolean().describe('Whether the file was newly created'),
})

type FileWriteInput = z.infer<typeof inputSchema>
type FileWriteOutput = z.infer<typeof outputSchema>

export const fileWriteToolDef: ToolDefinition = {
  name: 'file_write',
  groups: ['local', 'filesystem'],
  description: 'Write content to a file on the local filesystem',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'file_write',
      description:
        'Write content to a file on the local filesystem. Creates parent directories automatically. Use for creating and modifying source code, configuration files, and documents.',
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<FileWriteInput, FileWriteOutput>('/file/write', input, ctx.config)
      },
    }),
}
