import { spawn } from 'child_process'
import { z } from 'zod'
import type { Context } from 'hono'
import { getWorkspacePath } from '../auth.js'

const inputSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  timeout: z.number().optional().default(30000),
})

export type BashInput = z.infer<typeof inputSchema>

export type BashOutput = {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Execute a bash command and return the result
 */
export async function executeBash(input: BashInput): Promise<BashOutput> {
  const { command, cwd, timeout } = input

  // Use workspace path as default cwd
  const workDir = cwd ?? getWorkspacePath()

  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      cwd: workDir,
      timeout,
      env: { ...process.env, PATH: process.env['PATH'] },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (error) => {
      reject(new Error(`Failed to execute command: ${error.message}`))
    })

    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
      })
    })
  })
}

/**
 * Handle bash endpoint
 */
export async function handleBash(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = inputSchema.parse(body)
    const result = await executeBash(input)

    return c.json({ success: true, data: result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
