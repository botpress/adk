import { z } from 'zod'
import type { Context } from 'hono'
import { launchBrowserWithCDP, stopBrowser, type LaunchedBrowser } from '../browser/browser-launcher.js'
import {
  buildRoleSnapshotFromAriaSnapshot,
  getRoleSnapshotStats,
  type RoleRefMap,
} from '../browser/role-snapshot.js'
import { resolveLocator } from '../browser/ref-locator.js'

// Playwright types
import type { Browser, BrowserContext, Page, ConsoleMessage, ElementHandle, Dialog, Download } from 'playwright-core'

// Network request tracking
type BrowserNetworkRequest = {
  id: string
  timestamp: string
  method: string
  url: string
  resourceType?: string
  status?: number
  ok?: boolean
  failureText?: string
  responseHeaders?: Record<string, string>
  requestHeaders?: Record<string, string>
}

// Pending dialog handler
type DialogHandler = {
  action: 'accept' | 'dismiss'
  promptText?: string
  resolve: (result: { type: string; message: string; handled: boolean }) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

// Pending download info
type PendingDownload = {
  download: Download
  resolve: (result: { url: string; filename: string; path: string }) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

// Session storage with enhanced state
type BrowserSession = {
  id: string
  browser: Browser
  context: BrowserContext
  page: Page
  createdAt: Date
  // Native browser launch info (if using native browser)
  launchedBrowser?: LaunchedBrowser
  // Role refs from last snapshot
  roleRefs?: RoleRefMap
  // Console messages collected
  consoleMessages: Array<{ type: string; text: string; timestamp: number }>
  // Page errors collected
  pageErrors: Array<{ message: string; timestamp: number }>
  // Network request tracking
  networkRequests: BrowserNetworkRequest[]
  requestIdCounter: number
  // Pending dialog handler
  pendingDialogHandler?: DialogHandler
  // Pending downloads
  pendingDownloads: PendingDownload[]
  // Tracing state
  isTracing: boolean
}

const sessions: Map<string, BrowserSession> = new Map()

// Session ID generator
function generateSessionId(): string {
  return `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Dynamic import for Playwright (handles cases where it's not installed)
async function getPlaywright() {
  try {
    return await import('playwright-core')
  } catch {
    throw new Error('playwright-core is not installed. Run: bun add playwright-core')
  }
}

// ============ Input Schemas ============

const launchSchema = z.object({
  headless: z.boolean().optional().default(true),
  profile: z.string().optional(),
  viewport: z
    .object({
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  executablePath: z.string().optional().describe('Path to browser executable (uses system browser if not set)'),
  useNativeBrowser: z.boolean().optional().default(true).describe('Use native system browser instead of Playwright bundled Chromium'),
})

const navigateSchema = z.object({
  sessionId: z.string(),
  url: z.string(),
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle']).optional().default('load'),
})

const snapshotSchema = z.object({
  sessionId: z.string(),
  mode: z.enum(['full', 'interactive', 'efficient']).optional().default('interactive'),
  maxDepth: z.number().optional(),
})

const clickSchema = z.object({
  sessionId: z.string(),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e1, e2)'),
  selector: z.string().optional().describe('CSS selector (deprecated, prefer ref)'),
  button: z.enum(['left', 'right', 'middle']).optional().default('left'),
  clickCount: z.number().optional().default(1),
})

const typeSchema = z.object({
  sessionId: z.string(),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e1, e2)'),
  selector: z.string().optional().describe('CSS selector (deprecated, prefer ref)'),
  text: z.string(),
  delay: z.number().optional(),
  clear: z.boolean().optional().default(false),
})

const hoverSchema = z.object({
  sessionId: z.string(),
  ref: z.string().optional().describe('Element ref from snapshot (e.g., e1, e2)'),
  selector: z.string().optional().describe('CSS selector'),
})

const scrollSchema = z.object({
  sessionId: z.string(),
  ref: z.string().optional().describe('Element ref from snapshot'),
  selector: z.string().optional().describe('CSS selector'),
  direction: z.enum(['up', 'down', 'left', 'right']).optional(),
  amount: z.number().optional().describe('Amount to scroll in pixels'),
})

const pressKeySchema = z.object({
  sessionId: z.string(),
  key: z.string().describe('Key to press (e.g., Enter, Tab, Escape, ArrowDown)'),
  modifiers: z.array(z.enum(['Alt', 'Control', 'Meta', 'Shift'])).optional(),
})

const selectOptionSchema = z.object({
  sessionId: z.string(),
  ref: z.string().optional().describe('Element ref from snapshot'),
  selector: z.string().optional().describe('CSS selector'),
  value: z.string().optional().describe('Option value to select'),
  label: z.string().optional().describe('Option label to select'),
  index: z.number().optional().describe('Option index to select'),
})

const screenshotSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  fullPage: z.boolean().optional().default(false),
  format: z.enum(['png', 'jpeg']).optional().default('png'),
  quality: z.number().optional(),
})

const extractSchema = z.object({
  sessionId: z.string(),
  selector: z.string(),
  attributes: z.array(z.string()).optional(),
  includeText: z.boolean().optional().default(true),
  multiple: z.boolean().optional().default(false),
})

const executeSchema = z.object({
  sessionId: z.string(),
  script: z.string(),
  args: z.array(z.unknown()).optional(),
})

const waitSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional(),
  timeout: z.number().optional().default(30000),
  state: z.enum(['attached', 'detached', 'visible', 'hidden']).optional().default('visible'),
})

const closeSchema = z.object({
  sessionId: z.string(),
})

const consoleSchema = z.object({
  sessionId: z.string(),
  clear: z.boolean().optional().default(false),
})

const errorsSchema = z.object({
  sessionId: z.string(),
  clear: z.boolean().optional().default(false),
})

// ============ Phase 1: Core Interactions ============

const dragSchema = z.object({
  sessionId: z.string(),
  startRef: z.string().describe('Element ref (e1, e2) or selector to drag from'),
  endRef: z.string().describe('Element ref or selector to drag to'),
  timeout: z.number().optional().default(8000),
})

const fillFormSchema = z.object({
  sessionId: z.string(),
  fields: z.array(
    z.object({
      ref: z.string().optional().describe('Element ref from snapshot'),
      selector: z.string().optional().describe('CSS selector'),
      value: z.string().describe('Value to fill'),
      type: z.enum(['text', 'checkbox', 'radio', 'select']).optional().default('text'),
    })
  ),
})

const dialogSchema = z.object({
  sessionId: z.string(),
  action: z.enum(['accept', 'dismiss']),
  promptText: z.string().optional().describe('Text to enter for prompt dialogs'),
  timeout: z.number().optional().default(30000),
})

// ============ Phase 2: File Operations ============

const uploadSchema = z.object({
  sessionId: z.string(),
  ref: z.string().optional().describe('File input element ref'),
  selector: z.string().optional().describe('File input CSS selector'),
  paths: z.array(z.string()).describe('File paths to upload'),
  timeout: z.number().optional().default(30000),
})

const downloadSchema = z.object({
  sessionId: z.string(),
  clickRef: z.string().optional().describe('Element ref to click to trigger download'),
  clickSelector: z.string().optional().describe('CSS selector to click'),
  savePath: z.string().optional().describe('Path to save the downloaded file'),
  timeout: z.number().optional().default(30000),
})

const pdfSchema = z.object({
  sessionId: z.string(),
  path: z.string().optional().describe('Path to save the PDF'),
  options: z
    .object({
      format: z.enum(['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']).optional(),
      landscape: z.boolean().optional(),
      printBackground: z.boolean().optional(),
      scale: z.number().optional(),
      margin: z
        .object({
          top: z.string().optional(),
          bottom: z.string().optional(),
          left: z.string().optional(),
          right: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
})

// ============ Phase 3: State & Storage ============

const cookiesGetSchema = z.object({
  sessionId: z.string(),
  urls: z.array(z.string()).optional().describe('URLs to get cookies for (defaults to current page)'),
})

const cookiesSetSchema = z.object({
  sessionId: z.string(),
  cookies: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      url: z.string().optional(),
      domain: z.string().optional(),
      path: z.string().optional(),
      expires: z.number().optional(),
      httpOnly: z.boolean().optional(),
      secure: z.boolean().optional(),
      sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
    })
  ),
})

const cookiesClearSchema = z.object({
  sessionId: z.string(),
})

const storageGetSchema = z.object({
  sessionId: z.string(),
  kind: z.enum(['local', 'session']),
  key: z.string().optional().describe('Specific key to get (returns all if not specified)'),
})

const storageSetSchema = z.object({
  sessionId: z.string(),
  kind: z.enum(['local', 'session']),
  key: z.string(),
  value: z.string(),
})

const storageClearSchema = z.object({
  sessionId: z.string(),
  kind: z.enum(['local', 'session']),
})

// ============ Phase 4: Network & Debugging ============

const networkSchema = z.object({
  sessionId: z.string(),
  filter: z
    .object({
      urlPattern: z.string().optional(),
      method: z.string().optional(),
      resourceType: z.string().optional(),
    })
    .optional(),
  clear: z.boolean().optional().default(false),
  limit: z.number().optional().default(100),
})

const responseSchema = z.object({
  sessionId: z.string(),
  urlPattern: z.string().describe('URL pattern to match (substring or regex)'),
  timeout: z.number().optional().default(30000),
})

const traceStartSchema = z.object({
  sessionId: z.string(),
  screenshots: z.boolean().optional().default(true),
  snapshots: z.boolean().optional().default(true),
})

const traceStopSchema = z.object({
  sessionId: z.string(),
  path: z.string().describe('Path to save the trace file'),
})

// ============ Phase 5: Environment Emulation ============

const emulateDeviceSchema = z.object({
  sessionId: z.string(),
  device: z.string().describe('Device name (e.g., "iPhone 12", "Pixel 5")'),
})

const geolocationSchema = z.object({
  sessionId: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  accuracy: z.number().optional(),
  clear: z.boolean().optional().default(false),
})

const timezoneSchema = z.object({
  sessionId: z.string(),
  timezoneId: z.string().describe('IANA timezone ID (e.g., "America/New_York")'),
})

const localeSchema = z.object({
  sessionId: z.string(),
  locale: z.string().describe('Locale string (e.g., "en-US", "fr-FR")'),
})

const offlineSchema = z.object({
  sessionId: z.string(),
  offline: z.boolean(),
})

const headersSchema = z.object({
  sessionId: z.string(),
  headers: z.record(z.string()),
})

// ============ Helper Functions ============

function getSession(sessionId: string): BrowserSession {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Browser session not found: ${sessionId}`)
  }
  return session
}

function getRefOrSelector(input: { ref?: string; selector?: string }): string {
  if (input.ref) return input.ref
  if (input.selector) return input.selector
  throw new Error('Either ref or selector is required')
}

// ============ Handlers ============

export async function handleBrowserLaunch(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = launchSchema.parse(body)

    const pw = await getPlaywright()
    const sessionId = generateSessionId()

    let browser: Browser
    let launchedBrowser: LaunchedBrowser | undefined

    // Try native browser first if requested
    if (input.useNativeBrowser) {
      try {
        launchedBrowser = await launchBrowserWithCDP({
          headless: input.headless,
          profileName: input.profile,
          executablePath: input.executablePath,
        })
        // Connect Playwright to the running browser via CDP
        browser = await pw.chromium.connectOverCDP(launchedBrowser.wsEndpoint)
      } catch (err) {
        // Fall back to Playwright bundled browser
        console.warn('Native browser launch failed, falling back to Playwright:', err)
        browser = await pw.chromium.launch({
          headless: input.headless,
        })
      }
    } else {
      // Use Playwright bundled browser
      browser = await pw.chromium.launch({
        headless: input.headless,
      })
    }

    // Create context with viewport
    const context = await browser.newContext({
      viewport: input.viewport ?? { width: 1280, height: 720 },
    })

    // Create page
    const page = await context.newPage()

    const session: BrowserSession = {
      id: sessionId,
      browser,
      context,
      page,
      createdAt: new Date(),
      launchedBrowser,
      consoleMessages: [],
      pageErrors: [],
      networkRequests: [],
      requestIdCounter: 0,
      pendingDownloads: [],
      isTracing: false,
    }

    // Set up console message collection
    page.on('console', (msg: ConsoleMessage) => {
      session.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      })
      // Keep only last 100 messages
      if (session.consoleMessages.length > 100) {
        session.consoleMessages.shift()
      }
    })

    // Set up page error collection
    page.on('pageerror', (err: Error) => {
      session.pageErrors.push({
        message: err.message,
        timestamp: Date.now(),
      })
      // Keep only last 50 errors
      if (session.pageErrors.length > 50) {
        session.pageErrors.shift()
      }
    })

    // Set up network request tracking
    page.on('request', (request) => {
      const reqId = `req-${session.requestIdCounter++}`
      session.networkRequests.push({
        id: reqId,
        timestamp: new Date().toISOString(),
        method: request.method(),
        url: request.url(),
        resourceType: request.resourceType(),
        requestHeaders: request.headers(),
      })
      // Keep only last 1000 requests (circular buffer)
      if (session.networkRequests.length > 1000) {
        session.networkRequests.shift()
      }
    })

    page.on('response', (response) => {
      const req = session.networkRequests.find((r) => r.url === response.url() && !r.status)
      if (req) {
        req.status = response.status()
        req.ok = response.ok()
        req.responseHeaders = response.headers()
      }
    })

    page.on('requestfailed', (request) => {
      const req = session.networkRequests.find((r) => r.url === request.url() && !r.status)
      if (req) {
        req.failureText = request.failure()?.errorText
      }
    })

    // Set up dialog handler
    page.on('dialog', async (dialog: Dialog) => {
      const handler = session.pendingDialogHandler
      if (handler) {
        clearTimeout(handler.timeout)
        session.pendingDialogHandler = undefined
        try {
          if (handler.action === 'accept') {
            await dialog.accept(handler.promptText)
          } else {
            await dialog.dismiss()
          }
          handler.resolve({
            type: dialog.type(),
            message: dialog.message(),
            handled: true,
          })
        } catch (err) {
          handler.reject(err instanceof Error ? err : new Error(String(err)))
        }
      } else {
        // Auto-dismiss dialogs with no handler
        await dialog.dismiss()
      }
    })

    // Set up download handler
    page.on('download', (download: Download) => {
      const pending = session.pendingDownloads.shift()
      if (pending) {
        clearTimeout(pending.timeout)
        pending.resolve({
          url: download.url(),
          filename: download.suggestedFilename(),
          path: '', // Will be set after saveAs
        })
        // Store download for later saveAs
        ;(pending as any).download = download
      }
    })

    sessions.set(sessionId, session)

    return c.json({
      success: true,
      data: {
        sessionId,
        browserKind: launchedBrowser?.exe.kind ?? 'playwright-chromium',
        cdpPort: launchedBrowser?.cdpPort,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserNavigate(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = navigateSchema.parse(body)

    const session = getSession(input.sessionId)
    await session.page.goto(input.url, { waitUntil: input.waitUntil })

    return c.json({
      success: true,
      data: {
        success: true,
        title: await session.page.title(),
        url: session.page.url(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserSnapshot(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = snapshotSchema.parse(body)

    const session = getSession(input.sessionId)

    // Get aria snapshot from Playwright
    const ariaSnapshot = await session.page.locator('body').ariaSnapshot()

    // Build role snapshot with refs
    const { snapshot, refs } = buildRoleSnapshotFromAriaSnapshot(ariaSnapshot, {
      interactive: input.mode === 'interactive',
      compact: input.mode === 'efficient',
      maxDepth: input.maxDepth,
    })

    // Store refs in session for later use
    session.roleRefs = refs

    const stats = getRoleSnapshotStats(snapshot, refs)

    return c.json({
      success: true,
      data: {
        snapshot,
        refs,
        stats,
        url: session.page.url(),
        title: await session.page.title(),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserClick(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = clickSchema.parse(body)

    const session = getSession(input.sessionId)
    const target = getRefOrSelector(input)
    const locator = resolveLocator(session.page, target, session.roleRefs)

    await locator.click({
      button: input.button,
      clickCount: input.clickCount,
    })

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserType(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = typeSchema.parse(body)

    const session = getSession(input.sessionId)
    const target = getRefOrSelector(input)
    const locator = resolveLocator(session.page, target, session.roleRefs)

    if (input.clear) {
      await locator.fill('')
    }

    await locator.type(input.text, {
      delay: input.delay,
    })

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserHover(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = hoverSchema.parse(body)

    const session = getSession(input.sessionId)
    const target = getRefOrSelector(input)
    const locator = resolveLocator(session.page, target, session.roleRefs)

    await locator.hover()

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserScroll(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = scrollSchema.parse(body)

    const session = getSession(input.sessionId)

    if (input.ref || input.selector) {
      // Scroll element into view
      const target = getRefOrSelector(input)
      const locator = resolveLocator(session.page, target, session.roleRefs)
      await locator.scrollIntoViewIfNeeded()
    } else if (input.direction) {
      // Scroll page in direction
      const amount = input.amount ?? 300
      const deltaX = input.direction === 'left' ? -amount : input.direction === 'right' ? amount : 0
      const deltaY = input.direction === 'up' ? -amount : input.direction === 'down' ? amount : 0
      await session.page.mouse.wheel(deltaX, deltaY)
    }

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserPressKey(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = pressKeySchema.parse(body)

    const session = getSession(input.sessionId)

    // Build key combo string
    let keyCombo = input.key
    if (input.modifiers && input.modifiers.length > 0) {
      keyCombo = [...input.modifiers, input.key].join('+')
    }

    await session.page.keyboard.press(keyCombo)

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserSelectOption(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = selectOptionSchema.parse(body)

    const session = getSession(input.sessionId)
    const target = getRefOrSelector(input)
    const locator = resolveLocator(session.page, target, session.roleRefs)

    let selected: string[]
    if (input.value !== undefined) {
      selected = await locator.selectOption({ value: input.value })
    } else if (input.label !== undefined) {
      selected = await locator.selectOption({ label: input.label })
    } else if (input.index !== undefined) {
      selected = await locator.selectOption({ index: input.index })
    } else {
      throw new Error('One of value, label, or index is required')
    }

    return c.json({
      success: true,
      data: { success: true, selected },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserScreenshot(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = screenshotSchema.parse(body)

    const session = getSession(input.sessionId)

    let buffer: Buffer

    if (input.selector) {
      const element = await session.page.$(input.selector)
      if (!element) {
        return c.json({ success: false, error: `Element not found: ${input.selector}` }, 404)
      }
      buffer = await element.screenshot({
        type: input.format,
        quality: input.format === 'jpeg' ? input.quality : undefined,
      })
    } else {
      buffer = await session.page.screenshot({
        fullPage: input.fullPage,
        type: input.format,
        quality: input.format === 'jpeg' ? input.quality : undefined,
      })
    }

    // Get dimensions (approximate for full page)
    const viewport = session.page.viewportSize()

    return c.json({
      success: true,
      data: {
        base64: buffer.toString('base64'),
        width: viewport?.width ?? 1280,
        height: input.fullPage ? buffer.length : (viewport?.height ?? 720),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserExtract(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = extractSchema.parse(body)

    const session = getSession(input.sessionId)

    const elements = input.multiple
      ? await session.page.$$(input.selector)
      : [await session.page.$(input.selector)].filter(Boolean)

    const results = await Promise.all(
      elements.map(async (element: ElementHandle | null) => {
        if (!element) return null

        const result: { text?: string; html?: string; attributes?: Record<string, string> } = {}

        if (input.includeText) {
          result.text = (await element.textContent()) ?? ''
        }

        if (input.attributes && input.attributes.length > 0) {
          result.attributes = {}
          for (const attr of input.attributes) {
            const value = await element.getAttribute(attr)
            if (value !== null) {
              result.attributes[attr] = value
            }
          }
        }

        return result
      })
    )

    const filtered = results.filter((r) => r !== null)

    return c.json({
      success: true,
      data: {
        elements: filtered,
        count: filtered.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserExecute(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = executeSchema.parse(body)

    const session = getSession(input.sessionId)

    // Create a function from the script and execute it
    const result = await session.page.evaluate(
      ({ script, args }: { script: string; args: unknown[] }) => {
        // eslint-disable-next-line no-eval
        const fn = eval(`(${script})`)
        return typeof fn === 'function' ? fn(...(args ?? [])) : fn
      },
      { script: input.script, args: input.args ?? [] }
    )

    return c.json({
      success: true,
      data: { result },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserWait(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = waitSchema.parse(body)

    const session = getSession(input.sessionId)
    const startTime = Date.now()

    if (input.selector) {
      await session.page.waitForSelector(input.selector, {
        timeout: input.timeout,
        state: input.state,
      })
    } else {
      // Wait for timeout if no selector (useful for delays)
      await new Promise((resolve) => setTimeout(resolve, Math.min(input.timeout, 5000)))
    }

    return c.json({
      success: true,
      data: {
        success: true,
        elapsed: Date.now() - startTime,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserClose(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = closeSchema.parse(body)

    const session = sessions.get(input.sessionId)
    if (!session) {
      return c.json({ success: false, error: `Session not found: ${input.sessionId}` }, 404)
    }

    await session.page.close()
    await session.context.close()
    await session.browser.close()

    // Stop native browser if we launched one
    if (session.launchedBrowser) {
      await stopBrowser(session.launchedBrowser)
    }

    sessions.delete(input.sessionId)

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

// List all active browser sessions
export async function handleBrowserList(c: Context): Promise<Response> {
  const sessionList = Array.from(sessions.values()).map((session) => ({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    url: session.page.url(),
    browserKind: session.launchedBrowser?.exe.kind ?? 'playwright-chromium',
  }))

  return c.json({
    success: true,
    data: { sessions: sessionList },
  })
}

export async function handleBrowserConsole(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = consoleSchema.parse(body)

    const session = getSession(input.sessionId)

    const messages = [...session.consoleMessages]

    if (input.clear) {
      session.consoleMessages = []
    }

    return c.json({
      success: true,
      data: { messages, count: messages.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserErrors(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = errorsSchema.parse(body)

    const session = getSession(input.sessionId)

    const errors = [...session.pageErrors]

    if (input.clear) {
      session.pageErrors = []
    }

    return c.json({
      success: true,
      data: { errors, count: errors.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

// ============ Phase 1: Core Interactions ============

export async function handleBrowserDrag(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = dragSchema.parse(body)

    const session = getSession(input.sessionId)
    const timeout = Math.min(60000, Math.max(500, input.timeout))

    const startLocator = resolveLocator(session.page, input.startRef, session.roleRefs)
    const endLocator = resolveLocator(session.page, input.endRef, session.roleRefs)

    await startLocator.dragTo(endLocator, { timeout })

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserFillForm(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fillFormSchema.parse(body)

    const session = getSession(input.sessionId)
    let filled = 0

    for (const field of input.fields) {
      const target = field.ref || field.selector
      if (!target) {
        throw new Error('Either ref or selector is required for each field')
      }

      const locator = resolveLocator(session.page, target, session.roleRefs)

      switch (field.type) {
        case 'checkbox':
        case 'radio': {
          const shouldCheck = field.value === 'true' || field.value === '1'
          await locator.setChecked(shouldCheck)
          break
        }
        case 'select':
          await locator.selectOption(field.value)
          break
        case 'text':
        default:
          await locator.fill(field.value)
          break
      }
      filled++
    }

    return c.json({
      success: true,
      data: { success: true, filled },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserDialog(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = dialogSchema.parse(body)

    const session = getSession(input.sessionId)
    const timeout = Math.min(60000, Math.max(500, input.timeout))

    // Set up the dialog handler
    const result = await new Promise<{ type: string; message: string; handled: boolean }>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        session.pendingDialogHandler = undefined
        reject(new Error('Dialog timeout - no dialog appeared'))
      }, timeout)

      session.pendingDialogHandler = {
        action: input.action,
        promptText: input.promptText,
        resolve,
        reject,
        timeout: timeoutId,
      }
    })

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

// ============ Phase 2: File Operations ============

export async function handleBrowserUpload(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = uploadSchema.parse(body)

    const session = getSession(input.sessionId)

    if (input.ref || input.selector) {
      // Direct file input
      const target = input.ref || input.selector
      const locator = resolveLocator(session.page, target!, session.roleRefs)
      await locator.setInputFiles(input.paths)
    } else {
      // File chooser approach
      const timeout = Math.min(60000, Math.max(500, input.timeout))
      const [fileChooser] = await Promise.all([
        session.page.waitForEvent('filechooser', { timeout }),
        // Trigger is expected to happen externally or via another action
      ])
      await fileChooser.setFiles(input.paths)
    }

    return c.json({
      success: true,
      data: { success: true, filesUploaded: input.paths.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserDownload(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = downloadSchema.parse(body)

    const session = getSession(input.sessionId)
    const timeout = Math.min(60000, Math.max(500, input.timeout))

    // Set up download promise
    const downloadPromise = session.page.waitForEvent('download', { timeout })

    // Click to trigger download if ref/selector provided
    if (input.clickRef || input.clickSelector) {
      const target = input.clickRef || input.clickSelector
      const locator = resolveLocator(session.page, target!, session.roleRefs)
      await locator.click()
    }

    const download = await downloadPromise
    const filename = download.suggestedFilename()
    const url = download.url()

    let savedPath = ''
    if (input.savePath) {
      await download.saveAs(input.savePath)
      savedPath = input.savePath
    } else {
      savedPath = await download.path() || ''
    }

    return c.json({
      success: true,
      data: { url, filename, path: savedPath },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserPdf(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = pdfSchema.parse(body)

    const session = getSession(input.sessionId)

    const pdfOptions: any = {}
    if (input.options) {
      if (input.options.format) pdfOptions.format = input.options.format
      if (input.options.landscape !== undefined) pdfOptions.landscape = input.options.landscape
      if (input.options.printBackground !== undefined) pdfOptions.printBackground = input.options.printBackground
      if (input.options.scale !== undefined) pdfOptions.scale = input.options.scale
      if (input.options.margin) pdfOptions.margin = input.options.margin
    }

    if (input.path) {
      pdfOptions.path = input.path
    }

    const buffer = await session.page.pdf(pdfOptions)

    return c.json({
      success: true,
      data: {
        path: input.path || '',
        size: buffer.length,
        base64: input.path ? undefined : buffer.toString('base64'),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

// ============ Phase 3: State & Storage ============

export async function handleBrowserCookiesGet(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cookiesGetSchema.parse(body)

    const session = getSession(input.sessionId)
    const cookies = await session.context.cookies(input.urls)

    return c.json({
      success: true,
      data: { cookies },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserCookiesSet(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cookiesSetSchema.parse(body)

    const session = getSession(input.sessionId)
    await session.context.addCookies(input.cookies as any)

    return c.json({
      success: true,
      data: { success: true, count: input.cookies.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserCookiesClear(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cookiesClearSchema.parse(body)

    const session = getSession(input.sessionId)
    await session.context.clearCookies()

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserStorageGet(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = storageGetSchema.parse(body)

    const session = getSession(input.sessionId)
    const isLocal = input.kind === 'local'

    const values = await session.page.evaluate(
      ([isLocalStorage, key]: [boolean, string | undefined]) => {
        const storage = isLocalStorage ? localStorage : sessionStorage
        if (key) {
          return { [key]: storage.getItem(key) }
        }
        const result: Record<string, string | null> = {}
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i)
          if (k) {
            result[k] = storage.getItem(k)
          }
        }
        return result
      },
      [isLocal, input.key] as [boolean, string | undefined]
    )

    return c.json({
      success: true,
      data: { values },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserStorageSet(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = storageSetSchema.parse(body)

    const session = getSession(input.sessionId)
    const isLocal = input.kind === 'local'

    await session.page.evaluate(
      ([isLocalStorage, key, value]: [boolean, string, string]) => {
        const storage = isLocalStorage ? localStorage : sessionStorage
        storage.setItem(key, value)
      },
      [isLocal, input.key, input.value] as [boolean, string, string]
    )

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserStorageClear(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = storageClearSchema.parse(body)

    const session = getSession(input.sessionId)
    const isLocal = input.kind === 'local'

    await session.page.evaluate((isLocalStorage: boolean) => {
      const storage = isLocalStorage ? localStorage : sessionStorage
      storage.clear()
    }, isLocal)

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

// ============ Phase 4: Network & Debugging ============

export async function handleBrowserNetwork(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = networkSchema.parse(body)

    const session = getSession(input.sessionId)

    let requests = [...session.networkRequests]

    // Apply filters
    if (input.filter) {
      if (input.filter.urlPattern) {
        const pattern = input.filter.urlPattern
        requests = requests.filter((r) => r.url.includes(pattern) || new RegExp(pattern).test(r.url))
      }
      if (input.filter.method) {
        requests = requests.filter((r) => r.method === input.filter!.method)
      }
      if (input.filter.resourceType) {
        requests = requests.filter((r) => r.resourceType === input.filter!.resourceType)
      }
    }

    // Apply limit
    requests = requests.slice(-input.limit)

    if (input.clear) {
      session.networkRequests = []
    }

    return c.json({
      success: true,
      data: { requests, count: requests.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserResponse(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = responseSchema.parse(body)

    const session = getSession(input.sessionId)
    const timeout = Math.min(60000, Math.max(500, input.timeout))

    const response = await session.page.waitForResponse(
      (res) => res.url().includes(input.urlPattern) || new RegExp(input.urlPattern).test(res.url()),
      { timeout }
    )

    const contentType = response.headers()['content-type'] || ''
    let body_data: string | object

    try {
      if (contentType.includes('application/json')) {
        body_data = await response.json()
      } else {
        body_data = await response.text()
      }
    } catch {
      body_data = await response.text()
    }

    return c.json({
      success: true,
      data: {
        url: response.url(),
        status: response.status(),
        contentType,
        body: body_data,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserTraceStart(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = traceStartSchema.parse(body)

    const session = getSession(input.sessionId)

    if (session.isTracing) {
      return c.json({ success: false, error: 'Trace already in progress' }, 400)
    }

    await session.context.tracing.start({
      screenshots: input.screenshots,
      snapshots: input.snapshots,
    })

    session.isTracing = true

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserTraceStop(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = traceStopSchema.parse(body)

    const session = getSession(input.sessionId)

    if (!session.isTracing) {
      return c.json({ success: false, error: 'No trace in progress' }, 400)
    }

    await session.context.tracing.stop({ path: input.path })
    session.isTracing = false

    return c.json({
      success: true,
      data: { path: input.path },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

// ============ Phase 5: Environment Emulation ============

export async function handleBrowserEmulateDevice(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = emulateDeviceSchema.parse(body)

    const session = getSession(input.sessionId)
    const pw = await getPlaywright()

    const device = pw.devices[input.device]
    if (!device) {
      const availableDevices = Object.keys(pw.devices).slice(0, 20).join(', ')
      return c.json({
        success: false,
        error: `Device not found: ${input.device}. Available: ${availableDevices}...`,
      }, 400)
    }

    // Apply device settings via CDP
    const cdpSession = await session.page.context().newCDPSession(session.page)

    // Set viewport
    await session.page.setViewportSize(device.viewport)

    // Set user agent
    await cdpSession.send('Emulation.setUserAgentOverride', {
      userAgent: device.userAgent,
    })

    // Set device metrics
    await cdpSession.send('Emulation.setDeviceMetricsOverride', {
      width: device.viewport.width,
      height: device.viewport.height,
      deviceScaleFactor: device.deviceScaleFactor || 1,
      mobile: device.isMobile || false,
      screenWidth: device.viewport.width,
      screenHeight: device.viewport.height,
    })

    // Set touch if mobile
    if (device.hasTouch) {
      await cdpSession.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 5,
      })
    }

    return c.json({
      success: true,
      data: {
        success: true,
        viewport: device.viewport,
        userAgent: device.userAgent,
        isMobile: device.isMobile,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserGeolocation(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = geolocationSchema.parse(body)

    const session = getSession(input.sessionId)

    if (input.clear) {
      // Clear geolocation by setting to undefined
      await session.context.clearPermissions()
      return c.json({
        success: true,
        data: { success: true, cleared: true },
      })
    }

    if (input.latitude === undefined || input.longitude === undefined) {
      return c.json({ success: false, error: 'latitude and longitude required unless clearing' }, 400)
    }

    await session.context.grantPermissions(['geolocation'])
    await session.context.setGeolocation({
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
    })

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserTimezone(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = timezoneSchema.parse(body)

    const session = getSession(input.sessionId)

    const cdpSession = await session.page.context().newCDPSession(session.page)
    await cdpSession.send('Emulation.setTimezoneOverride', {
      timezoneId: input.timezoneId,
    })

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserLocale(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = localeSchema.parse(body)

    const session = getSession(input.sessionId)

    const cdpSession = await session.page.context().newCDPSession(session.page)
    await cdpSession.send('Emulation.setLocaleOverride', {
      locale: input.locale,
    })

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserOffline(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = offlineSchema.parse(body)

    const session = getSession(input.sessionId)
    await session.context.setOffline(input.offline)

    return c.json({
      success: true,
      data: { success: true, offline: input.offline },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

export async function handleBrowserHeaders(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = headersSchema.parse(body)

    const session = getSession(input.sessionId)
    await session.context.setExtraHTTPHeaders(input.headers)

    return c.json({
      success: true,
      data: { success: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
