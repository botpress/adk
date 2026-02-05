import { readFile, writeFile, access, constants } from 'fs/promises'
import { resolve, isAbsolute, relative } from 'path'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'
import { createPatch } from 'diff'

// Edit file schema
const fileEditInputSchema = z.object({
  path: z.string().describe('Path to the file to edit'),
  oldText: z.string().describe('The exact text to find and replace'),
  newText: z.string().describe('The replacement text'),
})

export type FileEditInput = z.infer<typeof fileEditInputSchema>

export type FileEditOutput = {
  path: string
  diff: string
  firstChangedLine: number
  success: boolean
}

/**
 * Resolve a path relative to the workspace
 */
function resolvePath(inputPath: string): string {
  const workspace = getWorkspacePath()

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
 * Find the line number of the first occurrence of a string
 */
function findFirstChangedLine(content: string, oldText: string): number {
  const lines = content.split('\n')
  let charIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineEnd = charIndex + line.length + 1 // +1 for newline

    if (content.indexOf(oldText, charIndex) < lineEnd) {
      const matchIndex = content.indexOf(oldText)
      if (matchIndex >= charIndex && matchIndex < lineEnd) {
        return i + 1 // 1-indexed line numbers
      }
    }
    charIndex = lineEnd
  }

  return 1
}

/**
 * Edit a file by replacing oldText with newText
 */
export async function editFileHandler(input: FileEditInput): Promise<FileEditOutput> {
  const { path: inputPath, oldText, newText } = input
  const filePath = resolvePath(inputPath)

  // Check file is accessible
  await access(filePath, constants.R_OK | constants.W_OK)

  // Read current content
  const content = await readFile(filePath, 'utf-8')

  // Check that oldText exists in the file
  if (!content.includes(oldText)) {
    throw new Error(
      `Could not find the specified text to replace in ${inputPath}. ` +
        `Make sure you're using the exact text including whitespace and line breaks.`
    )
  }

  // Check for unique match
  const firstIndex = content.indexOf(oldText)
  const secondIndex = content.indexOf(oldText, firstIndex + 1)

  if (secondIndex !== -1) {
    throw new Error(
      `Found multiple occurrences of the specified text in ${inputPath}. ` +
        `Please provide more context to uniquely identify the text to replace.`
    )
  }

  // Perform the replacement
  const newContent = content.replace(oldText, newText)

  // Generate diff
  const workspace = getWorkspacePath()
  const relativePath = relative(workspace, filePath)
  const diff = createPatch(relativePath, content, newContent, 'original', 'modified')

  // Find the first changed line
  const firstChangedLine = findFirstChangedLine(content, oldText)

  // Write the new content
  await writeFile(filePath, newContent, 'utf-8')

  return {
    path: filePath,
    diff,
    firstChangedLine,
    success: true,
  }
}

/**
 * Handle file edit endpoint
 */
export async function handleFileEdit(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fileEditInputSchema.parse(body)
    const result = await editFileHandler(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('ENOENT')
      ? 404
      : message.includes('EACCES')
        ? 403
        : message.includes('Could not find')
          ? 400
          : message.includes('multiple occurrences')
            ? 400
            : 500
    return c.json({ success: false, error: message }, status)
  }
}
