import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const inputSchema = z.object({
  path: z.string().describe('Path to the file to edit (absolute or relative to workspace)'),
  oldText: z.string().describe('The exact text to find and replace. Must match exactly including whitespace.'),
  newText: z.string().describe('The replacement text'),
})

const outputSchema = z.object({
  path: z.string().describe('Absolute path of the edited file'),
  diff: z.string().describe('Unified diff showing the changes made'),
  firstChangedLine: z.number().describe('Line number of the first change'),
  success: z.boolean().describe('Whether the edit was successful'),
})

type FileEditInput = z.infer<typeof inputSchema>
type FileEditOutput = z.infer<typeof outputSchema>

export const fileEditToolDef: ToolDefinition = {
  name: 'file_edit',
  groups: ['local', 'filesystem', 'coding'],
  description: 'Edit a file by replacing specific text with new text (search and replace)',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'file_edit',
      description: `Edit a file by replacing specific text with new text. This is the primary tool for making code changes.

IMPORTANT USAGE GUIDELINES:
- The oldText must match EXACTLY, including all whitespace, indentation, and line breaks
- If the oldText is not found, or if multiple matches exist, the edit will fail
- Provide enough context in oldText to uniquely identify the location (include surrounding lines)
- For large changes, break them into multiple smaller edits
- Always read the file first to get the exact content before editing

Example:
  path: "src/app.ts"
  oldText: "const port = 3000;"
  newText: "const port = process.env.PORT || 3000;"`,
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<FileEditInput, FileEditOutput>('/file/edit', input, ctx.config)
      },
    }),
}
