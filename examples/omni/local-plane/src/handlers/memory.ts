import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'

// Memory Read
const memoryReadInputSchema = z.object({
  key: z.string().optional(),
  namespace: z.string().optional().default('default'),
})

export type MemoryReadInput = z.infer<typeof memoryReadInputSchema>

export type MemoryReadOutput = {
  value?: unknown
  keys?: string[]
  found: boolean
}

// Memory Write
const memoryWriteInputSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  namespace: z.string().optional().default('default'),
})

export type MemoryWriteInput = z.infer<typeof memoryWriteInputSchema>

export type MemoryWriteOutput = {
  key: string
  success: boolean
  previousValue?: unknown
}

/**
 * Get the memory file path for a namespace
 */
function getMemoryPath(namespace: string): string {
  const workspace = getWorkspacePath()
  return join(workspace, '.omni', 'memory', `${namespace}.json`)
}

/**
 * Load memory data from file
 */
async function loadMemory(namespace: string): Promise<Record<string, unknown>> {
  const memoryPath = getMemoryPath(namespace)

  try {
    const content = await readFile(memoryPath, 'utf8')
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Save memory data to file
 */
async function saveMemory(namespace: string, data: Record<string, unknown>): Promise<void> {
  const memoryPath = getMemoryPath(namespace)

  // Ensure directory exists
  await mkdir(dirname(memoryPath), { recursive: true })

  // Write file
  await writeFile(memoryPath, JSON.stringify(data, null, 2))
}

/**
 * Read from memory
 */
export async function readMemory(input: MemoryReadInput): Promise<MemoryReadOutput> {
  const { key, namespace } = input
  const memory = await loadMemory(namespace)

  if (key === undefined) {
    // Return all keys
    return {
      keys: Object.keys(memory),
      found: true,
    }
  }

  const value = memory[key]

  return {
    value,
    found: value !== undefined,
  }
}

/**
 * Write to memory
 */
export async function writeMemory(input: MemoryWriteInput): Promise<MemoryWriteOutput> {
  const { key, value, namespace } = input
  const memory = await loadMemory(namespace)

  const previousValue = memory[key]
  memory[key] = value

  await saveMemory(namespace, memory)

  return {
    key,
    success: true,
    previousValue,
  }
}

/**
 * Handle memory read endpoint
 */
export async function handleMemoryRead(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = memoryReadInputSchema.parse(body)
    const result = await readMemory(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Handle memory write endpoint
 */
export async function handleMemoryWrite(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = memoryWriteInputSchema.parse(body)
    const result = await writeMemory(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
