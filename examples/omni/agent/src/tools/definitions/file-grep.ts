import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'

const matchSchema = z.object({
  file: z.string().describe('Relative path to the file'),
  line: z.number().describe('Line number of the match (1-indexed)'),
  content: z.string().describe('The matching line content'),
  context: z.object({
    before: z.array(z.string()).describe('Lines before the match'),
    after: z.array(z.string()).describe('Lines after the match'),
  }),
})

const inputSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z.string().optional().describe('Directory or file to search in (default: workspace root)'),
  glob: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts", "**/*.js")'),
  ignoreCase: z.boolean().optional().describe('Case-insensitive search (default: false)'),
  literal: z.boolean().optional().describe('Treat pattern as literal string, not regex (default: false)'),
  context: z.number().optional().describe('Number of context lines before and after matches (default: 2)'),
  limit: z.number().optional().describe('Maximum number of matches to return (default: 100)'),
})

const outputSchema = z.object({
  matches: z.array(matchSchema).describe('List of matches found'),
  totalMatches: z.number().describe('Total number of matches found'),
  truncated: z.boolean().describe('Whether results were truncated due to limit'),
  filesSearched: z.number().describe('Number of files searched'),
})

type GrepInput = z.infer<typeof inputSchema>
type GrepOutput = z.infer<typeof outputSchema>

export const fileGrepToolDef: ToolDefinition = {
  name: 'file_grep',
  groups: ['local', 'filesystem', 'coding'],
  description: 'Search for a pattern in file contents across the codebase',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'file_grep',
      description: `Search for a pattern in file contents using regular expressions.

Use this tool to:
- Find where a function or variable is used
- Search for specific patterns or strings in the codebase
- Find all TODO comments or specific annotations
- Locate configuration values or API endpoints

Examples:
  pattern: "async function" glob: "**/*.ts"  - Find all async functions in TypeScript files
  pattern: "TODO:" ignoreCase: true          - Find all TODO comments
  pattern: "import.*from 'react'" path: "src" - Find React imports in src directory
  pattern: "getUser" literal: true            - Find literal string "getUser"

The results include context lines around each match for better understanding.`,
      input: inputSchema,
      output: outputSchema,
      handler: async (input) => {
        return await callLocalPlane<GrepInput, GrepOutput>('/file/grep', input, ctx.config)
      },
    }),
}
