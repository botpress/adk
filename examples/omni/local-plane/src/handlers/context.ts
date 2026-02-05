import { readFile } from 'fs/promises'
import { resolve, join } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'

const inputSchema = z.object({
  files: z.array(z.string()).optional(),
  includeMemory: z.boolean().optional().default(false),
})

export type ContextLoadInput = z.infer<typeof inputSchema>

export type ContextLoadOutput = {
  soul?: string
  agents?: string
  memory?: string
  customFiles?: Record<string, string>
  loadedCount: number
}

/**
 * Default files to load
 */
const DEFAULT_FILES = ['SOUL.md', 'AGENTS.md']

/**
 * Memory directory relative to workspace
 */
const MEMORY_DIR = '.omni/memory'

/**
 * Try to read a file, returning undefined if it doesn't exist
 */
async function tryReadFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf8')
  } catch {
    return undefined
  }
}

/**
 * Load context files from the workspace
 */
export async function loadContext(input: ContextLoadInput): Promise<ContextLoadOutput> {
  const { files, includeMemory } = input
  const workspace = getWorkspacePath()

  const result: ContextLoadOutput = {
    loadedCount: 0,
  }

  // Load SOUL.md
  const soulPath = resolve(workspace, 'SOUL.md')
  const soul = await tryReadFile(soulPath)
  if (soul) {
    result.soul = soul
    result.loadedCount++
  }

  // Load AGENTS.md
  const agentsPath = resolve(workspace, 'AGENTS.md')
  const agents = await tryReadFile(agentsPath)
  if (agents) {
    result.agents = agents
    result.loadedCount++
  }

  // Load memory if requested
  if (includeMemory) {
    const memoryPath = join(workspace, MEMORY_DIR, 'memory.json')
    const memory = await tryReadFile(memoryPath)
    if (memory) {
      result.memory = memory
      result.loadedCount++
    }
  }

  // Load custom files if specified
  if (files && files.length > 0) {
    const customFiles: Record<string, string> = {}

    for (const file of files) {
      // Skip default files (already loaded above)
      if (DEFAULT_FILES.includes(file)) {
        continue
      }

      const filePath = resolve(workspace, file)
      const content = await tryReadFile(filePath)
      if (content) {
        customFiles[file] = content
        result.loadedCount++
      }
    }

    if (Object.keys(customFiles).length > 0) {
      result.customFiles = customFiles
    }
  }

  return result
}

/**
 * Handle context load endpoint
 */
export async function handleContextLoad(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = inputSchema.parse(body)
    const result = await loadContext(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
