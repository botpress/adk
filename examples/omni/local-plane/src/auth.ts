import type { Context, Next } from 'hono'
import { randomBytes } from 'crypto'
import { homedir } from 'os'
import { join } from 'path'

// Token is set once at startup (either from env or auto-generated)
let activeToken: string | null = null

/**
 * Initialize the auth token - uses env var if set, otherwise generates one
 * Returns the token for display in CLI
 */
export function initializeToken(): { token: string; generated: boolean } {
  const envToken = process.env['LOCAL_PLANE_TOKEN']
  if (envToken) {
    activeToken = envToken
    return { token: envToken, generated: false }
  }

  // Generate a random token
  activeToken = randomBytes(32).toString('hex')
  return { token: activeToken, generated: true }
}

/**
 * Get the active token
 */
export function getExpectedToken(): string | undefined {
  return activeToken ?? undefined
}

/**
 * Bearer token authentication middleware
 */
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const expectedToken = getExpectedToken()

  // Token should always be set (either from env or auto-generated)
  if (!expectedToken) {
    return c.json({ success: false, error: 'Server not initialized' }, 500)
  }

  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    return c.json({ success: false, error: 'Missing Authorization header' }, 401)
  }

  if (!authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Invalid Authorization header format' }, 401)
  }

  const token = authHeader.slice(7)

  if (token !== expectedToken) {
    return c.json({ success: false, error: 'Invalid token' }, 403)
  }

  return next()
}

/**
 * Validate that required environment variables are set
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
  // WORKSPACE_PATH is optional (defaults to ~/omni)
  const required: string[] = []
  const missing: string[] = []

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Get the configured workspace path
 * Defaults to ~/omni if WORKSPACE_PATH is not set
 */
export function getWorkspacePath(): string {
  return process.env['WORKSPACE_PATH'] ?? join(homedir(), 'omni')
}
