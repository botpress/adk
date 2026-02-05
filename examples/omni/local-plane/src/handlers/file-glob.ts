import { readdir, stat } from 'fs/promises'
import { resolve, isAbsolute, relative, join } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'
import { minimatch } from 'minimatch'

// Glob/Find schema
const globInputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts", "src/**/*.js")'),
  path: z.string().optional().describe('Directory to search in (default: workspace root)'),
  limit: z.number().optional().default(1000).describe('Maximum number of files to return'),
})

export type GlobInput = z.infer<typeof globInputSchema>

export type GlobOutput = {
  files: string[]
  totalFound: number
  truncated: boolean
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
 * Check if a directory should be ignored
 */
function shouldIgnoreDir(name: string): boolean {
  return IGNORE_DIRS.has(name)
}

/**
 * Recursively find files matching a glob pattern
 */
async function findFiles(
  dir: string,
  pattern: string,
  workspace: string,
  limit: number,
  results: string[] = []
): Promise<{ files: string[]; truncated: boolean }> {
  if (results.length >= limit) {
    return { files: results, truncated: true }
  }

  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (results.length >= limit) {
      return { files: results, truncated: true }
    }

    const fullPath = join(dir, entry.name)
    const relativePath = relative(workspace, fullPath)

    if (entry.isDirectory()) {
      // Skip ignored directories
      if (shouldIgnoreDir(entry.name)) {
        continue
      }

      // Recurse into directory
      const subResult = await findFiles(fullPath, pattern, workspace, limit, results)
      if (subResult.truncated) {
        return subResult
      }
    } else if (entry.isFile()) {
      // Match against pattern
      if (minimatch(relativePath, pattern, { matchBase: true })) {
        results.push(relativePath)
      }
    }
  }

  return { files: results, truncated: false }
}

/**
 * Find files matching a glob pattern
 */
export async function globHandler(input: GlobInput): Promise<GlobOutput> {
  const { pattern, path: inputPath, limit } = input

  const searchPath = resolvePath(inputPath)
  const workspace = getWorkspacePath()

  // Check path exists
  const pathStat = await stat(searchPath)
  if (!pathStat.isDirectory()) {
    throw new Error('Path must be a directory')
  }

  // Find matching files
  const result = await findFiles(searchPath, pattern, workspace, limit)

  // Sort results alphabetically
  result.files.sort()

  return {
    files: result.files,
    totalFound: result.files.length,
    truncated: result.truncated,
  }
}

/**
 * Handle glob/find endpoint
 */
export async function handleGlob(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = globInputSchema.parse(body)
    const result = await globHandler(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : 500
    return c.json({ success: false, error: message }, status)
  }
}
