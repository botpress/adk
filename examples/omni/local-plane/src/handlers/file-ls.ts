import { readdir, stat } from 'fs/promises'
import { resolve, isAbsolute, relative, join } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'

// List directory schema
const lsInputSchema = z.object({
  path: z.string().optional().describe('Directory to list (default: workspace root)'),
  recursive: z.boolean().optional().default(false).describe('Recursively list subdirectories'),
  includeHidden: z.boolean().optional().default(false).describe('Include hidden files (starting with .)'),
  limit: z.number().optional().default(1000).describe('Maximum number of entries to return'),
})

export type LsInput = z.infer<typeof lsInputSchema>

export type LsEntry = {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink' | 'other'
  size?: number
  modified?: string
}

export type LsOutput = {
  entries: LsEntry[]
  totalEntries: number
  truncated: boolean
}

// Directories to skip in recursive mode
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '__pycache__',
  '.cache',
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
 * Get entry type from dirent
 */
function getEntryType(dirent: import('fs').Dirent): LsEntry['type'] {
  if (dirent.isFile()) return 'file'
  if (dirent.isDirectory()) return 'directory'
  if (dirent.isSymbolicLink()) return 'symlink'
  return 'other'
}

/**
 * List directory contents
 */
async function listDirectory(
  dir: string,
  workspace: string,
  options: { recursive: boolean; includeHidden: boolean; limit: number },
  results: LsEntry[] = [],
  depth: number = 0
): Promise<{ entries: LsEntry[]; truncated: boolean }> {
  if (results.length >= options.limit) {
    return { entries: results, truncated: true }
  }

  const dirents = await readdir(dir, { withFileTypes: true })

  for (const dirent of dirents) {
    if (results.length >= options.limit) {
      return { entries: results, truncated: true }
    }

    // Skip hidden files if not requested
    if (!options.includeHidden && dirent.name.startsWith('.')) {
      continue
    }

    const fullPath = join(dir, dirent.name)
    const relativePath = relative(workspace, fullPath)
    const type = getEntryType(dirent)

    // Get file stats for size and modified time
    let size: number | undefined
    let modified: string | undefined
    try {
      const stats = await stat(fullPath)
      if (type === 'file') {
        size = stats.size
      }
      modified = stats.mtime.toISOString()
    } catch {
      // Skip if can't stat
    }

    results.push({
      name: dirent.name,
      path: relativePath,
      type,
      size,
      modified,
    })

    // Recurse into directories if recursive mode
    if (options.recursive && type === 'directory' && !SKIP_DIRS.has(dirent.name)) {
      const subResult = await listDirectory(fullPath, workspace, options, results, depth + 1)
      if (subResult.truncated) {
        return subResult
      }
    }
  }

  return { entries: results, truncated: false }
}

/**
 * List directory handler
 */
export async function lsHandler(input: LsInput): Promise<LsOutput> {
  const { path: inputPath, recursive, includeHidden, limit } = input

  const listPath = resolvePath(inputPath)
  const workspace = getWorkspacePath()

  // Check path exists and is a directory
  const pathStat = await stat(listPath)
  if (!pathStat.isDirectory()) {
    throw new Error('Path must be a directory')
  }

  // List directory
  const result = await listDirectory(listPath, workspace, {
    recursive,
    includeHidden,
    limit,
  })

  // Sort entries: directories first, then files, alphabetically within each group
  result.entries.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1
    return a.path.localeCompare(b.path)
  })

  return {
    entries: result.entries,
    totalEntries: result.entries.length,
    truncated: result.truncated,
  }
}

/**
 * Handle ls endpoint
 */
export async function handleLs(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = lsInputSchema.parse(body)
    const result = await lsHandler(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : 500
    return c.json({ success: false, error: message }, status)
  }
}
