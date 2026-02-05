import { readFile, readdir, stat } from 'fs/promises'
import { resolve, isAbsolute, relative, join } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'
import { minimatch } from 'minimatch'

// Grep schema
const grepInputSchema = z.object({
  pattern: z.string().describe('Regular expression pattern to search for'),
  path: z.string().optional().describe('Directory or file to search in (default: workspace root)'),
  glob: z.string().optional().describe('Glob pattern to filter files (e.g., "*.ts", "**/*.js")'),
  ignoreCase: z.boolean().optional().default(false).describe('Case-insensitive search'),
  literal: z.boolean().optional().default(false).describe('Treat pattern as literal string, not regex'),
  context: z.number().optional().default(2).describe('Number of context lines before and after matches'),
  limit: z.number().optional().default(100).describe('Maximum number of matches to return'),
})

export type GrepInput = z.infer<typeof grepInputSchema>

export type GrepMatch = {
  file: string
  line: number
  content: string
  context: {
    before: string[]
    after: string[]
  }
}

export type GrepOutput = {
  matches: GrepMatch[]
  totalMatches: number
  truncated: boolean
  filesSearched: number
}

// Directories to ignore during search
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  '.cache',
  'coverage',
  '.adk',
])

/**
 * Resolve a path relative to the workspace
 */
function resolvePath(inputPath: string | undefined): string {
  const workspace = getWorkspacePath()

  if (!inputPath) {
    return workspace
  }

  if (isAbsolute(inputPath)) {
    const resolved = resolve(inputPath)
    if (!resolved.startsWith(workspace)) {
      throw new Error('Path must be within workspace')
    }
    return resolved
  }

  return resolve(workspace, inputPath)
}

/**
 * Check if a path should be ignored
 */
function shouldIgnore(name: string): boolean {
  return IGNORE_DIRS.has(name) || name.startsWith('.')
}

/**
 * Recursively collect files matching glob pattern
 */
async function collectFiles(dir: string, globPattern?: string, files: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) {
      continue
    }

    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await collectFiles(fullPath, globPattern, files)
    } else if (entry.isFile()) {
      const workspace = getWorkspacePath()
      const relativePath = relative(workspace, fullPath)

      // Apply glob filter if specified
      if (globPattern) {
        if (minimatch(relativePath, globPattern) || minimatch(entry.name, globPattern)) {
          files.push(fullPath)
        }
      } else {
        // Default: include common text file extensions
        if (isTextFile(entry.name)) {
          files.push(fullPath)
        }
      }
    }
  }

  return files
}

/**
 * Check if a file is likely a text file based on extension
 */
function isTextFile(name: string): boolean {
  const textExtensions = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.json',
    '.md',
    '.txt',
    '.yml',
    '.yaml',
    '.toml',
    '.xml',
    '.html',
    '.css',
    '.scss',
    '.less',
    '.py',
    '.rb',
    '.go',
    '.rs',
    '.java',
    '.kt',
    '.swift',
    '.c',
    '.cpp',
    '.h',
    '.hpp',
    '.sh',
    '.bash',
    '.zsh',
    '.fish',
    '.env',
    '.gitignore',
    '.eslintrc',
    '.prettierrc',
    'Dockerfile',
    'Makefile',
    '.sql',
    '.graphql',
    '.gql',
    '.vue',
    '.svelte',
  ])

  const ext = name.includes('.') ? '.' + name.split('.').pop()!.toLowerCase() : name
  return textExtensions.has(ext) || textExtensions.has(name)
}

/**
 * Search for pattern in files
 */
export async function grepHandler(input: GrepInput): Promise<GrepOutput> {
  const { pattern, path: inputPath, glob: globPattern, ignoreCase, literal, context, limit } = input

  const searchPath = resolvePath(inputPath)
  const workspace = getWorkspacePath()

  // Build regex
  let regex: RegExp
  try {
    const flags = ignoreCase ? 'gi' : 'g'
    const searchPattern = literal ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern
    regex = new RegExp(searchPattern, flags)
  } catch (e) {
    throw new Error(`Invalid regex pattern: ${pattern}`)
  }

  // Collect files to search
  const pathStat = await stat(searchPath)
  let files: string[]

  if (pathStat.isFile()) {
    files = [searchPath]
  } else {
    files = await collectFiles(searchPath, globPattern)
  }

  const matches: GrepMatch[] = []
  let totalMatches = 0
  let truncated = false

  // Search files
  for (const file of files) {
    if (truncated) break

    try {
      const content = await readFile(file, 'utf-8')
      const lines = content.split('\n')
      const relativePath = relative(workspace, file)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        regex.lastIndex = 0 // Reset regex state

        if (regex.test(line)) {
          totalMatches++

          if (matches.length < limit) {
            // Gather context lines
            const beforeStart = Math.max(0, i - context)
            const afterEnd = Math.min(lines.length, i + context + 1)

            matches.push({
              file: relativePath,
              line: i + 1, // 1-indexed
              content: line,
              context: {
                before: lines.slice(beforeStart, i),
                after: lines.slice(i + 1, afterEnd),
              },
            })
          } else {
            truncated = true
            break
          }
        }
      }
    } catch {
      // Skip files that can't be read (binary, permissions, etc.)
      continue
    }
  }

  return {
    matches,
    totalMatches,
    truncated,
    filesSearched: files.length,
  }
}

/**
 * Handle grep endpoint
 */
export async function handleGrep(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = grepInputSchema.parse(body)
    const result = await grepHandler(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : message.includes('Invalid regex') ? 400 : 500
    return c.json({ success: false, error: message }, status)
  }
}
