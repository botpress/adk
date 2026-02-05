import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { type BrowserExecutable, resolveBrowserExecutable } from './executable-discovery.js'

export type { BrowserExecutable } from './executable-discovery.js'

// Default profile directory for Omni browser sessions
const OMNI_DATA_DIR = path.join(os.homedir(), '.omni')

export type LaunchedBrowser = {
  pid: number
  exe: BrowserExecutable
  userDataDir: string
  cdpPort: number
  wsEndpoint: string
  startedAt: number
  proc: ChildProcessWithoutNullStreams
}

export type LaunchBrowserOptions = {
  headless?: boolean
  cdpPort?: number
  userDataDir?: string
  executablePath?: string
  profileName?: string
  noSandbox?: boolean
}

function exists(filePath: string) {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function cdpUrlForPort(port: number) {
  return `http://127.0.0.1:${port}`
}

type ChromeVersion = {
  webSocketDebuggerUrl?: string
  Browser?: string
  'User-Agent'?: string
}

async function fetchChromeVersion(cdpUrl: string, timeoutMs = 500): Promise<ChromeVersion | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const versionUrl = `${cdpUrl}/json/version`
    const res = await fetch(versionUrl, { signal: ctrl.signal })
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as ChromeVersion
    if (!data || typeof data !== 'object') {
      return null
    }
    return data
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function isChromeReachable(cdpUrl: string, timeoutMs = 500): Promise<boolean> {
  const version = await fetchChromeVersion(cdpUrl, timeoutMs)
  return Boolean(version)
}

export async function getChromeWebSocketUrl(cdpUrl: string, timeoutMs = 500): Promise<string | null> {
  const version = await fetchChromeVersion(cdpUrl, timeoutMs)
  const wsUrl = String(version?.webSocketDebuggerUrl ?? '').trim()
  if (!wsUrl) {
    return null
  }
  // Normalize the WebSocket URL to use 127.0.0.1 instead of 0.0.0.0
  return wsUrl.replace(/ws:\/\/[^:]+:/, `ws://127.0.0.1:`)
}

export function resolveOmniUserDataDir(profileName = 'default') {
  return path.join(OMNI_DATA_DIR, 'browser', profileName, 'user-data')
}

async function findAvailablePort(startPort: number): Promise<number> {
  // Simple port availability check - try to connect and if it fails, port is likely available
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 100)
      await fetch(`http://127.0.0.1:${port}`, { signal: ctrl.signal })
      clearTimeout(t)
      // If fetch succeeded, port is in use
    } catch {
      // Fetch failed, port is likely available
      return port
    }
  }
  return startPort // Fall back to start port
}

export async function launchBrowserWithCDP(options: LaunchBrowserOptions = {}): Promise<LaunchedBrowser> {
  const exe = resolveBrowserExecutable({ executablePath: options.executablePath })
  if (!exe) {
    throw new Error('No supported browser found (Chrome/Brave/Edge/Chromium on macOS, Linux, or Windows).')
  }

  const cdpPort = options.cdpPort ?? (await findAvailablePort(9222))
  const profileName = options.profileName ?? 'default'
  const userDataDir = options.userDataDir ?? resolveOmniUserDataDir(profileName)

  fs.mkdirSync(userDataDir, { recursive: true })

  const spawnBrowser = () => {
    const args: string[] = [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-features=Translate,MediaRouter',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      '--password-store=basic',
    ]

    if (options.headless) {
      args.push('--headless=new')
      args.push('--disable-gpu')
    }

    if (options.noSandbox || process.platform === 'linux') {
      args.push('--no-sandbox')
      args.push('--disable-setuid-sandbox')
    }

    if (process.platform === 'linux') {
      args.push('--disable-dev-shm-usage')
    }

    // Always open a blank tab to ensure a target exists
    args.push('about:blank')

    return spawn(exe.path, args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        HOME: os.homedir(),
      },
    })
  }

  const startedAt = Date.now()

  // Bootstrap profile if it doesn't exist
  const localStatePath = path.join(userDataDir, 'Local State')
  const preferencesPath = path.join(userDataDir, 'Default', 'Preferences')
  const needsBootstrap = !exists(localStatePath) || !exists(preferencesPath)

  if (needsBootstrap) {
    const bootstrap = spawnBrowser()
    const deadline = Date.now() + 10_000
    while (Date.now() < deadline) {
      if (exists(localStatePath) && exists(preferencesPath)) {
        break
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    try {
      bootstrap.kill('SIGTERM')
    } catch {
      // ignore
    }
    const exitDeadline = Date.now() + 5000
    while (Date.now() < exitDeadline) {
      if (bootstrap.exitCode != null) {
        break
      }
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  const proc = spawnBrowser()

  // Wait for CDP to come up
  const cdpUrl = cdpUrlForPort(cdpPort)
  const readyDeadline = Date.now() + 15_000
  while (Date.now() < readyDeadline) {
    if (await isChromeReachable(cdpUrl, 500)) {
      break
    }
    await new Promise((r) => setTimeout(r, 200))
  }

  if (!(await isChromeReachable(cdpUrl, 500))) {
    try {
      proc.kill('SIGKILL')
    } catch {
      // ignore
    }
    throw new Error(`Failed to start Chrome CDP on port ${cdpPort}. Browser may not have started correctly.`)
  }

  const wsEndpoint = await getChromeWebSocketUrl(cdpUrl, 500)
  if (!wsEndpoint) {
    try {
      proc.kill('SIGKILL')
    } catch {
      // ignore
    }
    throw new Error(`Failed to get Chrome WebSocket URL from CDP on port ${cdpPort}.`)
  }

  const pid = proc.pid ?? -1

  return {
    pid,
    exe,
    userDataDir,
    cdpPort,
    wsEndpoint,
    startedAt,
    proc,
  }
}

export async function stopBrowser(launched: LaunchedBrowser, timeoutMs = 2500) {
  const proc = launched.proc
  if (proc.killed) {
    return
  }
  try {
    proc.kill('SIGTERM')
  } catch {
    // ignore
  }

  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (!proc.exitCode && proc.killed) {
      break
    }
    if (!(await isChromeReachable(cdpUrlForPort(launched.cdpPort), 200))) {
      return
    }
    await new Promise((r) => setTimeout(r, 100))
  }

  try {
    proc.kill('SIGKILL')
  } catch {
    // ignore
  }
}
