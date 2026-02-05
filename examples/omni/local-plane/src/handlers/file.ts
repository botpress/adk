import { readFile, writeFile, mkdir, stat } from 'fs/promises'
import { dirname, resolve, isAbsolute } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'

// File Read
const fileReadInputSchema = z.object({
  path: z.string(),
  encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
  maxSize: z.number().optional().default(1024 * 1024), // 1MB default
})

export type FileReadInput = z.infer<typeof fileReadInputSchema>

export type FileReadOutput = {
  content: string
  path: string
  size: number
  truncated: boolean
}

// File Write
const fileWriteInputSchema = z.object({
  path: z.string(),
  content: z.string(),
  encoding: z.enum(['utf8', 'base64']).optional().default('utf8'),
  createDirs: z.boolean().optional().default(true),
  overwrite: z.boolean().optional().default(true),
})

export type FileWriteInput = z.infer<typeof fileWriteInputSchema>

export type FileWriteOutput = {
  path: string
  size: number
  created: boolean
}

/**
 * Resolve a path relative to the workspace
 */
function resolvePath(inputPath: string): string {
  const workspace = getWorkspacePath()

  if (isAbsolute(inputPath)) {
    // Ensure absolute paths are within workspace (security)
    const resolved = resolve(inputPath)
    if (!resolved.startsWith(workspace)) {
      throw new Error('Path must be within workspace')
    }
    return resolved
  }

  return resolve(workspace, inputPath)
}

/**
 * Read a file from the filesystem
 */
export async function readFileHandler(input: FileReadInput): Promise<FileReadOutput> {
  const { path: inputPath, encoding, maxSize } = input
  const filePath = resolvePath(inputPath)

  // Get file stats
  const stats = await stat(filePath)
  const truncated = stats.size > maxSize

  // Read file content
  const buffer = await readFile(filePath)
  const contentBuffer = truncated ? buffer.subarray(0, maxSize) : buffer

  let content: string
  if (encoding === 'base64') {
    content = contentBuffer.toString('base64')
  } else {
    content = contentBuffer.toString('utf8')
  }

  return {
    content,
    path: filePath,
    size: stats.size,
    truncated,
  }
}

/**
 * Write content to a file
 */
export async function writeFileHandler(input: FileWriteInput): Promise<FileWriteOutput> {
  const { path: inputPath, content, encoding, createDirs, overwrite } = input
  const filePath = resolvePath(inputPath)

  // Check if file exists
  let fileExists = false
  try {
    await stat(filePath)
    fileExists = true
  } catch {
    // File doesn't exist
  }

  if (fileExists && !overwrite) {
    throw new Error('File already exists and overwrite is disabled')
  }

  // Create parent directories if needed
  if (createDirs) {
    await mkdir(dirname(filePath), { recursive: true })
  }

  // Write the file
  let buffer: Buffer
  if (encoding === 'base64') {
    buffer = Buffer.from(content, 'base64')
  } else {
    buffer = Buffer.from(content, 'utf8')
  }

  await writeFile(filePath, buffer)

  return {
    path: filePath,
    size: buffer.length,
    created: !fileExists,
  }
}

/**
 * Handle file read endpoint
 */
export async function handleFileRead(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fileReadInputSchema.parse(body)
    const result = await readFileHandler(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('ENOENT') ? 404 : 500
    return c.json({ success: false, error: message }, status)
  }
}

/**
 * Handle file write endpoint
 */
export async function handleFileWrite(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fileWriteInputSchema.parse(body)
    const result = await writeFileHandler(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
