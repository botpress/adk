import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const inputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts", "src/**/*.js")'),
  path: z.string().optional().describe('Directory to search in (default: workspace root)'),
  limit: z.number().optional().describe('Maximum number of files to return (default: 1000)'),
})

const outputSchema = z.object({
  files: z.array(z.string()).describe('List of matching file paths (relative to workspace)'),
  totalFound: z.number().describe('Total number of files found'),
  truncated: z.boolean().describe('Whether results were truncated due to limit'),
})

type GlobInput = z.infer<typeof inputSchema>
type GlobOutput = z.infer<typeof outputSchema>

export const fileGlobToolDef: ToolDefinition = {
  name: 'file_glob',
  groups: ['local', 'filesystem', 'coding'],
  description: 'Find files matching a glob pattern in the codebase',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'file_glob',
      description: `Find files matching a glob pattern. Use this to discover files in the codebase.

Common patterns:
  **/*.ts          - All TypeScript files
  **/*.{ts,tsx}    - All TypeScript and TSX files
  src/**/*.js      - All JavaScript files under src/
  **/test/**/*.ts  - All TypeScript files in test directories
  *.json           - JSON files in root directory
  **/*config*      - Files with "config" in their name

This tool automatically ignores common directories like node_modules, .git, dist, etc.

Use this tool to:
- Find all files of a specific type
- Discover project structure
- Locate configuration files
- Find test files`,
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<GlobInput, GlobOutput>('/file/glob', input, ctx.config)
      },
    }),
}
