import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const entrySchema = z.object({
  name: z.string().describe('Name of the file or directory'),
  path: z.string().describe('Relative path from workspace'),
  type: z.enum(['file', 'directory', 'symlink', 'other']).describe('Type of entry'),
  size: z.number().optional().describe('File size in bytes (files only)'),
  modified: z.string().optional().describe('Last modified timestamp (ISO 8601)'),
})

const inputSchema = z.object({
  path: z.string().optional().describe('Directory to list (default: workspace root)'),
  recursive: z.boolean().optional().describe('Recursively list subdirectories (default: false)'),
  includeHidden: z.boolean().optional().describe('Include hidden files starting with . (default: false)'),
  limit: z.number().optional().describe('Maximum number of entries to return (default: 1000)'),
})

const outputSchema = z.object({
  entries: z.array(entrySchema).describe('List of directory entries'),
  totalEntries: z.number().describe('Total number of entries'),
  truncated: z.boolean().describe('Whether results were truncated due to limit'),
})

type LsInput = z.infer<typeof inputSchema>
type LsOutput = z.infer<typeof outputSchema>

export const fileLsToolDef: ToolDefinition = {
  name: 'file_ls',
  groups: ['local', 'filesystem', 'coding'],
  description: 'List directory contents',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'file_ls',
      description: `List the contents of a directory.

Use this tool to:
- Explore the project structure
- See what files exist in a directory
- Check file sizes and modification times
- Discover subdirectories

By default, hidden files (starting with .) are not shown. Use includeHidden: true to show them.
In recursive mode, common directories like node_modules, .git, dist are automatically skipped.

Results are sorted with directories first, then files, both alphabetically.`,
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<LsInput, LsOutput>('/file/ls', input, ctx.config)
      },
    }),
}
