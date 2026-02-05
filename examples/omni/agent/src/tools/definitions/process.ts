import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../types.js'
import { callLocalPlane } from '../../bridge/client.js'
import type {
  ProcessSpawnInput,
  ProcessSpawnOutput,
  ProcessSendKeysInput,
  ProcessSendKeysOutput,
  ProcessReadInput,
  ProcessReadOutput,
  ProcessKillInput,
  ProcessKillOutput,
  ProcessListInput,
  ProcessListOutput,
  ProcessResizeInput,
  ProcessResizeOutput,
} from '../../process/types.js'

// ============ process_spawn ============

const spawnInputSchema = z.object({
  command: z.string().describe('Command to execute (e.g., "bash", "vim", "python")'),
  cwd: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Additional environment variables'),
  cols: z.number().optional().describe('Terminal columns (default: 80)'),
  rows: z.number().optional().describe('Terminal rows (default: 24)'),
})

const spawnOutputSchema = z.object({
  sessionId: z.string().describe('Session ID for future operations'),
  pid: z.number().describe('Process ID'),
})

export const processSpawnToolDef: ToolDefinition = {
  name: 'process_spawn',
  groups: ['process', 'local'],
  description: 'Start a new interactive PTY session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'process_spawn',
      description:
        'Start a new interactive terminal session (PTY). Use for running interactive CLI tools like vim, tmux, python REPL, etc. Returns a sessionId for subsequent operations.',
      input: spawnInputSchema,
      output: spawnOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<ProcessSpawnInput, ProcessSpawnOutput>('/process/spawn', input, ctx.config)
      },
    }),
}

// ============ process_send_keys ============

const sendKeysInputSchema = z.object({
  sessionId: z.string().describe('Session ID from process_spawn'),
  keys: z.string().describe(
    `Keys to send using tmux-style encoding:
- Literal text: typed as-is
- C-c, C-d: Ctrl+C, Ctrl+D
- M-x: Alt+X
- Enter, Tab, Escape, Space, Backspace
- Up, Down, Left, Right (arrow keys)
- F1-F12 (function keys)
Examples: "ls -la Enter", "C-c", "vim file.txt Enter :wq Enter"`
  ),
})

const sendKeysOutputSchema = z.object({
  success: z.boolean().describe('Whether keys were sent successfully'),
})

export const processSendKeysToolDef: ToolDefinition = {
  name: 'process_send_keys',
  groups: ['process', 'local'],
  description: 'Send keystrokes to an interactive PTY session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'process_send_keys',
      description:
        'Send keystrokes to an interactive terminal session. Supports tmux-style key encoding (C-c for Ctrl+C, M-x for Alt+X, Enter, Tab, arrow keys, etc.).',
      input: sendKeysInputSchema,
      output: sendKeysOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<ProcessSendKeysInput, ProcessSendKeysOutput>('/process/send-keys', input, ctx.config)
      },
    }),
}

// ============ process_read ============

const readInputSchema = z.object({
  sessionId: z.string().describe('Session ID from process_spawn'),
  wait: z.number().optional().describe('Wait time in ms for new output (0 = immediate return, default: 100)'),
  clear: z.boolean().optional().describe('Clear the output buffer after reading (default: true)'),
})

const readOutputSchema = z.object({
  content: z.string().describe('Terminal output content'),
  lines: z.number().describe('Number of lines in output'),
  hasMore: z.boolean().describe('Whether more output is available'),
})

export const processReadToolDef: ToolDefinition = {
  name: 'process_read',
  groups: ['process', 'local'],
  description: 'Read output from an interactive PTY session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'process_read',
      description: 'Read the current output buffer from an interactive terminal session. Use after sending commands to see results.',
      input: readInputSchema,
      output: readOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<ProcessReadInput, ProcessReadOutput>('/process/read', input, ctx.config)
      },
    }),
}

// ============ process_kill ============

const killInputSchema = z.object({
  sessionId: z.string().describe('Session ID from process_spawn'),
  signal: z.enum(['SIGTERM', 'SIGKILL', 'SIGINT']).optional().describe('Signal to send (default: SIGTERM)'),
})

const killOutputSchema = z.object({
  success: z.boolean().describe('Whether the process was killed'),
  exitCode: z.number().optional().describe('Exit code if process exited'),
})

export const processKillToolDef: ToolDefinition = {
  name: 'process_kill',
  groups: ['process', 'local'],
  description: 'Kill an interactive PTY session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'process_kill',
      description: 'Terminate an interactive terminal session. Use SIGTERM for graceful shutdown, SIGKILL for force kill.',
      input: killInputSchema,
      output: killOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<ProcessKillInput, ProcessKillOutput>('/process/kill', input, ctx.config)
      },
    }),
}

// ============ process_list ============

const listInputSchema = z.object({
  verbose: z.boolean().optional().describe('Include detailed session information'),
})

const listOutputSchema = z.object({
  sessions: z.array(
    z.object({
      id: z.string(),
      pid: z.number(),
      command: z.string(),
      cwd: z.string(),
      createdAt: z.string(),
      lastActivity: z.string(),
    })
  ).describe('List of active PTY sessions'),
})

export const processListToolDef: ToolDefinition = {
  name: 'process_list',
  groups: ['process', 'local'],
  description: 'List active PTY sessions',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'process_list',
      description: 'List all active interactive terminal sessions.',
      input: listInputSchema,
      output: listOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<ProcessListInput, ProcessListOutput>('/process/list', input, ctx.config)
      },
    }),
}

// ============ process_resize ============

const resizeInputSchema = z.object({
  sessionId: z.string().describe('Session ID from process_spawn'),
  cols: z.number().describe('New terminal width in columns'),
  rows: z.number().describe('New terminal height in rows'),
})

const resizeOutputSchema = z.object({
  success: z.boolean().describe('Whether the terminal was resized'),
})

export const processResizeToolDef: ToolDefinition = {
  name: 'process_resize',
  groups: ['process', 'local'],
  description: 'Resize a PTY terminal',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'process_resize',
      description: 'Resize the terminal dimensions of an interactive session.',
      input: resizeInputSchema,
      output: resizeOutputSchema,
      handler: async (input) => {
        return await callLocalPlane<ProcessResizeInput, ProcessResizeOutput>('/process/resize', input, ctx.config)
      },
    }),
}
