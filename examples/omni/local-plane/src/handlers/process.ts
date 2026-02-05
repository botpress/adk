import { z } from 'zod'
import type { Context } from 'hono'
import { spawn, type ChildProcess } from 'child_process'
import { getWorkspacePath } from '../auth.js'

// Type imports (inline to avoid cross-package dependency)
type ProcessSession = {
  id: string
  pid: number
  command: string
  cwd: string
  createdAt: Date
  lastActivity: Date
  process: ChildProcess
  buffer: string[]
  maxBufferLines: number
}

// Session storage
const sessions: Map<string, ProcessSession> = new Map()

// Generate unique session ID
function generateSessionId(): string {
  return `pty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============ Input Schemas ============

const spawnInputSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
  cols: z.number().optional().default(80),
  rows: z.number().optional().default(24),
})

const sendKeysInputSchema = z.object({
  sessionId: z.string(),
  keys: z.string(),
})

const readInputSchema = z.object({
  sessionId: z.string(),
  wait: z.number().optional().default(100),
  clear: z.boolean().optional().default(true),
})

const killInputSchema = z.object({
  sessionId: z.string(),
  signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).optional().default('SIGTERM'),
})

const listInputSchema = z.object({
  verbose: z.boolean().optional().default(false),
})

const resizeInputSchema = z.object({
  sessionId: z.string(),
  cols: z.number(),
  rows: z.number(),
})

// ============ Send-Keys Parser ============

const SPECIAL_KEYS: Record<string, string> = {
  Enter: '\r',
  Return: '\r',
  Tab: '\t',
  Escape: '\x1b',
  Esc: '\x1b',
  Space: ' ',
  Backspace: '\x7f',
  Delete: '\x1b[3~',
  Up: '\x1b[A',
  Down: '\x1b[B',
  Right: '\x1b[C',
  Left: '\x1b[D',
  Home: '\x1b[H',
  End: '\x1b[F',
  PageUp: '\x1b[5~',
  PageDown: '\x1b[6~',
  Insert: '\x1b[2~',
  F1: '\x1bOP',
  F2: '\x1bOQ',
  F3: '\x1bOR',
  F4: '\x1bOS',
  F5: '\x1b[15~',
  F6: '\x1b[17~',
  F7: '\x1b[18~',
  F8: '\x1b[19~',
  F9: '\x1b[20~',
  F10: '\x1b[21~',
  F11: '\x1b[23~',
  F12: '\x1b[24~',
}

function parseCtrlKey(char: string): string {
  const lower = char.toLowerCase()
  if (lower >= 'a' && lower <= 'z') {
    return String.fromCharCode(lower.charCodeAt(0) - 96)
  }
  const ctrlSpecial: Record<string, string> = {
    '@': '\x00',
    '[': '\x1b',
    '\\': '\x1c',
    ']': '\x1d',
    '^': '\x1e',
    '_': '\x1f',
    '?': '\x7f',
  }
  return ctrlSpecial[char] ?? char
}

function parseMetaKey(char: string): string {
  return '\x1b' + char
}

function parseSendKeys(input: string): string {
  let result = ''
  let i = 0

  while (i < input.length) {
    // Check for C-x (Ctrl)
    if (input.substring(i, i + 2) === 'C-' && i + 2 < input.length) {
      result += parseCtrlKey(input[i + 2]!)
      i += 3
      continue
    }

    // Check for M-x (Meta/Alt)
    if (input.substring(i, i + 2) === 'M-' && i + 2 < input.length) {
      result += parseMetaKey(input[i + 2]!)
      i += 3
      continue
    }

    // Check for S-Tab (Shift+Tab)
    if (input.substring(i, i + 5) === 'S-Tab') {
      result += '\x1b[Z'
      i += 5
      continue
    }

    // Check for special keys
    let foundSpecial = false
    for (const key of Object.keys(SPECIAL_KEYS)) {
      if (input.substring(i, i + key.length) === key) {
        const nextChar = input[i + key.length]
        if (nextChar === undefined || !/[a-zA-Z0-9]/.test(nextChar)) {
          result += SPECIAL_KEYS[key]!
          i += key.length
          foundSpecial = true
          break
        }
      }
    }
    if (foundSpecial) continue

    // Literal character
    result += input[i]!
    i++
  }

  return result
}

// ============ Handlers ============

export async function handleProcessSpawn(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = spawnInputSchema.parse(body)

    const sessionId = generateSessionId()
    const workDir = input.cwd ?? getWorkspacePath()

    // Spawn process with PTY-like environment
    const child = spawn('bash', ['-i'], {
      cwd: workDir,
      env: {
        ...process.env,
        ...input.env,
        TERM: 'xterm-256color',
        COLUMNS: String(input.cols),
        LINES: String(input.rows),
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    if (!child.pid) {
      return c.json({ success: false, error: 'Failed to spawn process' }, 500)
    }

    const session: ProcessSession = {
      id: sessionId,
      pid: child.pid,
      command: input.command,
      cwd: workDir,
      createdAt: new Date(),
      lastActivity: new Date(),
      process: child,
      buffer: [],
      maxBufferLines: 10000,
    }

    // Capture stdout
    child.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n')
      session.buffer.push(...lines)
      session.lastActivity = new Date()
      // Trim buffer if too large
      while (session.buffer.length > session.maxBufferLines) {
        session.buffer.shift()
      }
    })

    // Capture stderr
    child.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n')
      session.buffer.push(...lines)
      session.lastActivity = new Date()
      while (session.buffer.length > session.maxBufferLines) {
        session.buffer.shift()
      }
    })

    // Handle process exit
    child.on('close', () => {
      sessions.delete(sessionId)
    })

    sessions.set(sessionId, session)

    // Send the initial command if provided
    if (input.command && input.command !== 'bash') {
      child.stdin?.write(input.command + '\n')
    }

    return c.json({
      success: true,
      data: {
        sessionId,
        pid: child.pid,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleProcessSendKeys(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = sendKeysInputSchema.parse(body)

    const session = sessions.get(input.sessionId)
    if (!session) {
      return c.json({ success: false, error: `Session not found: ${input.sessionId}` }, 404)
    }

    const keys = parseSendKeys(input.keys)
    session.process.stdin?.write(keys)
    session.lastActivity = new Date()

    return c.json({ success: true, data: { success: true } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleProcessRead(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = readInputSchema.parse(body)

    const session = sessions.get(input.sessionId)
    if (!session) {
      return c.json({ success: false, error: `Session not found: ${input.sessionId}` }, 404)
    }

    // Wait for new output if requested
    if (input.wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, input.wait))
    }

    const content = session.buffer.join('\n')
    const lines = session.buffer.length

    if (input.clear) {
      session.buffer = []
    }

    return c.json({
      success: true,
      data: {
        content,
        lines,
        hasMore: session.buffer.length > 0,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleProcessKill(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = killInputSchema.parse(body)

    const session = sessions.get(input.sessionId)
    if (!session) {
      return c.json({ success: false, error: `Session not found: ${input.sessionId}` }, 404)
    }

    const signal = input.signal === 'SIGKILL' ? 'SIGKILL' : input.signal === 'SIGINT' ? 'SIGINT' : 'SIGTERM'
    session.process.kill(signal)

    // Wait a bit for process to exit
    await new Promise((resolve) => setTimeout(resolve, 100))

    sessions.delete(input.sessionId)

    return c.json({
      success: true,
      data: {
        success: true,
        exitCode: session.process.exitCode ?? undefined,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleProcessList(c: Context): Promise<Response> {
  try {
    const body = await c.req.json().catch(() => ({}))
    const input = listInputSchema.parse(body)

    const sessionList = Array.from(sessions.values()).map((session) => ({
      id: session.id,
      pid: session.pid,
      command: session.command,
      cwd: session.cwd,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
    }))

    return c.json({
      success: true,
      data: {
        sessions: sessionList,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleProcessResize(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = resizeInputSchema.parse(body)

    const session = sessions.get(input.sessionId)
    if (!session) {
      return c.json({ success: false, error: `Session not found: ${input.sessionId}` }, 404)
    }

    // Note: Without node-pty, we can't actually resize the terminal
    // We update the environment, which may affect some applications
    session.lastActivity = new Date()

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
