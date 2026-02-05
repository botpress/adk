/**
 * CDP Client - Raw Chrome DevTools Protocol client
 *
 * Provides direct WebSocket communication with CDP endpoints
 * for app introspection and instrumentation.
 */

import WebSocket from 'ws'

export type CDPMessage = {
  id?: number
  method?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: { code: number; message: string }
}

export type CDPTarget = {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl?: string
  devtoolsFrontendUrl?: string
  faviconUrl?: string
}

export type CDPSession = {
  id: string
  wsEndpoint: string
  ws: WebSocket
  targetId?: string
  messageId: number
  pendingRequests: Map<number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
  }>
}

// Active CDP sessions
const sessions: Map<string, CDPSession> = new Map()

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `cdp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Fetch available CDP targets from a debug port
 */
export async function fetchCDPTargets(
  cdpPort: number,
  host = '127.0.0.1'
): Promise<CDPTarget[]> {
  const url = `http://${host}:${cdpPort}/json/list`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

  if (!res.ok) {
    throw new Error(`Failed to fetch CDP targets: ${res.status}`)
  }

  return res.json() as Promise<CDPTarget[]>
}

/**
 * Fetch CDP version info
 */
export type CDPVersion = {
  Browser: string
  'Protocol-Version': string
  'User-Agent': string
  'V8-Version': string
  'WebKit-Version': string
  webSocketDebuggerUrl: string
}

export async function fetchCDPVersion(
  cdpPort: number,
  host = '127.0.0.1'
): Promise<CDPVersion> {
  const url = `http://${host}:${cdpPort}/json/version`
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) })

  if (!res.ok) {
    throw new Error(`Failed to fetch CDP version: ${res.status}`)
  }

  return res.json() as Promise<CDPVersion>
}

/**
 * Connect to a CDP endpoint
 */
export async function connectToCDP(
  wsEndpoint: string,
  targetId?: string
): Promise<CDPSession> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsEndpoint)
    const sessionId = generateSessionId()
    const session: CDPSession = {
      id: sessionId,
      wsEndpoint,
      ws,
      targetId,
      messageId: 0,
      pendingRequests: new Map(),
    }

    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('CDP connection timeout'))
    }, 10000)

    ws.on('open', () => {
      clearTimeout(timeout)
      sessions.set(sessionId, session)
      resolve(session)
    })

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString()) as CDPMessage
        if (message.id !== undefined) {
          const pending = session.pendingRequests.get(message.id)
          if (pending) {
            session.pendingRequests.delete(message.id)
            if (message.error) {
              pending.reject(new Error(`CDP error: ${message.error.message}`))
            } else {
              pending.resolve(message.result)
            }
          }
        }
        // Events are currently ignored but could be emitted
      } catch {
        // Ignore parse errors
      }
    })

    ws.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    ws.on('close', () => {
      sessions.delete(sessionId)
      // Reject any pending requests
      for (const [, pending] of session.pendingRequests) {
        pending.reject(new Error('CDP connection closed'))
      }
      session.pendingRequests.clear()
    })
  })
}

/**
 * Send a CDP command and wait for response
 */
export async function sendCDPCommand<T = unknown>(
  session: CDPSession,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++session.messageId
    const message: CDPMessage = { id, method, params }

    session.pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
    })

    session.ws.send(JSON.stringify(message), (err) => {
      if (err) {
        session.pendingRequests.delete(id)
        reject(err)
      }
    })

    // Timeout for individual commands
    setTimeout(() => {
      if (session.pendingRequests.has(id)) {
        session.pendingRequests.delete(id)
        reject(new Error(`CDP command timeout: ${method}`))
      }
    }, 30000)
  })
}

/**
 * Get an existing CDP session
 */
export function getCDPSession(sessionId: string): CDPSession | undefined {
  return sessions.get(sessionId)
}

/**
 * Close a CDP session
 */
export function closeCDPSession(sessionId: string): boolean {
  const session = sessions.get(sessionId)
  if (!session) return false

  session.ws.close()
  sessions.delete(sessionId)
  return true
}

/**
 * List all active CDP sessions
 */
export function listCDPSessions(): Array<{
  id: string
  wsEndpoint: string
  targetId?: string
}> {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    wsEndpoint: s.wsEndpoint,
    targetId: s.targetId,
  }))
}

/**
 * Evaluate JavaScript in the page context
 */
export async function evaluateInContext(
  session: CDPSession,
  expression: string,
  options?: {
    contextId?: number
    returnByValue?: boolean
    awaitPromise?: boolean
    includeCommandLineAPI?: boolean
  }
): Promise<{
  result: {
    type: string
    value?: unknown
    description?: string
    objectId?: string
  }
  exceptionDetails?: {
    text: string
    exception?: { description?: string }
  }
}> {
  return sendCDPCommand(session, 'Runtime.evaluate', {
    expression,
    returnByValue: options?.returnByValue ?? true,
    awaitPromise: options?.awaitPromise ?? true,
    includeCommandLineAPI: options?.includeCommandLineAPI ?? true,
    ...(options?.contextId && { contextId: options.contextId }),
  })
}

/**
 * Get DOM document
 */
export async function getDocument(session: CDPSession): Promise<{
  root: {
    nodeId: number
    backendNodeId: number
    nodeType: number
    nodeName: string
    localName: string
    nodeValue: string
    childNodeCount?: number
    children?: unknown[]
    attributes?: string[]
  }
}> {
  return sendCDPCommand(session, 'DOM.getDocument', { depth: -1 })
}

/**
 * Query selector
 */
export async function querySelector(
  session: CDPSession,
  nodeId: number,
  selector: string
): Promise<{ nodeId: number }> {
  return sendCDPCommand(session, 'DOM.querySelector', { nodeId, selector })
}

/**
 * Query selector all
 */
export async function querySelectorAll(
  session: CDPSession,
  nodeId: number,
  selector: string
): Promise<{ nodeIds: number[] }> {
  return sendCDPCommand(session, 'DOM.querySelectorAll', { nodeId, selector })
}

/**
 * Get box model for a node
 */
export async function getBoxModel(
  session: CDPSession,
  nodeId: number
): Promise<{
  model: {
    content: number[]
    padding: number[]
    border: number[]
    margin: number[]
    width: number
    height: number
  }
}> {
  return sendCDPCommand(session, 'DOM.getBoxModel', { nodeId })
}

/**
 * Enable Runtime domain
 */
export async function enableRuntime(session: CDPSession): Promise<void> {
  await sendCDPCommand(session, 'Runtime.enable')
}

/**
 * Enable DOM domain
 */
export async function enableDOM(session: CDPSession): Promise<void> {
  await sendCDPCommand(session, 'DOM.enable')
}

/**
 * Enable Page domain
 */
export async function enablePage(session: CDPSession): Promise<void> {
  await sendCDPCommand(session, 'Page.enable')
}

/**
 * Navigate to URL
 */
export async function navigateTo(
  session: CDPSession,
  url: string
): Promise<{ frameId: string; loaderId?: string; errorText?: string }> {
  return sendCDPCommand(session, 'Page.navigate', { url })
}

/**
 * Take screenshot
 */
export async function captureScreenshot(
  session: CDPSession,
  options?: {
    format?: 'jpeg' | 'png' | 'webp'
    quality?: number
    clip?: { x: number; y: number; width: number; height: number; scale: number }
    fromSurface?: boolean
    captureBeyondViewport?: boolean
  }
): Promise<{ data: string }> {
  return sendCDPCommand(session, 'Page.captureScreenshot', {
    format: options?.format ?? 'png',
    quality: options?.quality,
    clip: options?.clip,
    fromSurface: options?.fromSurface ?? true,
    captureBeyondViewport: options?.captureBeyondViewport ?? false,
  })
}
