/**
 * Process/PTY session types for interactive terminal control
 */

/**
 * Represents a PTY session
 */
export type ProcessSession = {
  /** Unique session identifier */
  id: string
  /** Process ID of the PTY */
  pid: number
  /** Command that started the session */
  command: string
  /** Working directory */
  cwd: string
  /** When the session was created */
  createdAt: Date
  /** Last activity timestamp */
  lastActivity: Date
}

/**
 * Session info returned to clients (serializable)
 */
export type ProcessSessionInfo = {
  id: string
  pid: number
  command: string
  cwd: string
  createdAt: string
  lastActivity: string
}

/**
 * Input for spawning a new process
 */
export type ProcessSpawnInput = {
  /** Command to execute */
  command: string
  /** Working directory */
  cwd?: string
  /** Environment variables to set */
  env?: Record<string, string>
  /** Initial terminal columns */
  cols?: number
  /** Initial terminal rows */
  rows?: number
}

/**
 * Output from spawning a process
 */
export type ProcessSpawnOutput = {
  /** Session ID for future operations */
  sessionId: string
  /** Process ID */
  pid: number
}

/**
 * Input for sending keys to a process
 */
export type ProcessSendKeysInput = {
  /** Session ID */
  sessionId: string
  /** Keys to send (tmux-style encoding) */
  keys: string
}

/**
 * Output from sending keys
 */
export type ProcessSendKeysOutput = {
  success: boolean
}

/**
 * Input for reading process output
 */
export type ProcessReadInput = {
  /** Session ID */
  sessionId: string
  /** Wait time in ms for new output (0 = immediate return) */
  wait?: number
  /** Clear buffer after reading */
  clear?: boolean
}

/**
 * Output from reading process output
 */
export type ProcessReadOutput = {
  /** Output content */
  content: string
  /** Number of lines */
  lines: number
  /** Whether more output is available */
  hasMore: boolean
}

/**
 * Input for killing a process
 */
export type ProcessKillInput = {
  /** Session ID */
  sessionId: string
  /** Signal to send */
  signal?: 'SIGTERM' | 'SIGKILL' | 'SIGINT'
}

/**
 * Output from killing a process
 */
export type ProcessKillOutput = {
  success: boolean
  /** Exit code if process exited */
  exitCode?: number
}

/**
 * Input for listing active sessions
 */
export type ProcessListInput = {
  /** Include session details */
  verbose?: boolean
}

/**
 * Output from listing sessions
 */
export type ProcessListOutput = {
  sessions: ProcessSessionInfo[]
}

/**
 * Input for resizing a terminal
 */
export type ProcessResizeInput = {
  sessionId: string
  cols: number
  rows: number
}

/**
 * Output from resizing
 */
export type ProcessResizeOutput = {
  success: boolean
}
