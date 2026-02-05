import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const inputSchema = z.object({
  command: z.string().describe('The bash command to execute'),
  cwd: z.string().optional().describe('Working directory for command execution'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
})

const outputSchema = z.object({
  stdout: z.string().describe('Standard output from the command'),
  stderr: z.string().describe('Standard error from the command'),
  exitCode: z.number().describe('Exit code from the command'),
})

type BashInput = z.infer<typeof inputSchema>
type BashOutput = z.infer<typeof outputSchema>

export const bashToolDef: ToolDefinition = {
  name: 'bash',
  groups: ['local', 'coding'],
  description: 'Execute bash commands on the local machine',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'bash',
      description:
        'Execute bash commands on the local machine. Use for running scripts, system commands, git operations, and other CLI tasks.',
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<BashInput, BashOutput>('/bash', input, ctx.config)
      },
    }),
}
