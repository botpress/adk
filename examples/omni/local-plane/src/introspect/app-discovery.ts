/**
 * App Discovery - Find and analyze running applications
 *
 * Detects running processes, identifies Electron/Chromium apps,
 * and finds available CDP debug ports.
 */

import { execSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import os from 'node:os'

export type AppType = 'electron' | 'chromium' | 'native' | 'unknown'

export type DiscoveredApp = {
  pid: number
  name: string
  path?: string
  bundleId?: string
  type: AppType
  cdpPort?: number
  wsEndpoint?: string
  version?: string
  mainArgs?: string[]
}

export type ProcessInfo = {
  pid: number
  name: string
  command: string
  args: string[]
}

/**
 * List running processes on macOS
 */
function listProcessesMac(): ProcessInfo[] {
  try {
    const output = execSync('ps -axo pid,comm', { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
    const lines = output.trim().split('\n').slice(1) // Skip header

    const results: ProcessInfo[] = []
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/)
      if (!match) continue

      const pid = parseInt(match[1], 10)
      const command = match[2].trim()
      const name = command.split('/').pop() || command

      results.push({
        pid,
        name,
        command,
        args: [] as string[],
      })
    }
    return results
  } catch {
    return []
  }
}

/**
 * List running processes on Linux
 */
function listProcessesLinux(): ProcessInfo[] {
  try {
    const output = execSync('ps -eo pid,comm --no-headers', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    })
    const lines = output.trim().split('\n')

    const results: ProcessInfo[] = []
    for (const line of lines) {
      const match = line.trim().match(/^(\d+)\s+(.+)$/)
      if (!match) continue

      const pid = parseInt(match[1], 10)
      const name = match[2].trim()

      results.push({
        pid,
        name,
        command: name,
        args: [] as string[],
      })
    }
    return results
  } catch {
    return []
  }
}

/**
 * List running processes (cross-platform)
 */
export function listProcesses(): ProcessInfo[] {
  const platform = os.platform()

  if (platform === 'darwin') {
    return listProcessesMac()
  } else if (platform === 'linux') {
    return listProcessesLinux()
  }

  // Windows not yet supported
  return []
}

/**
 * Get process command line on macOS
 */
function getProcessArgsMac(pid: number): string[] {
  try {
    const output = execSync(`ps -p ${pid} -o args=`, {
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
    })
    return output.trim().split(/\s+/).slice(1) // First element is the command itself
  } catch {
    return []
  }
}

/**
 * Get process command line on Linux
 */
function getProcessArgsLinux(pid: number): string[] {
  try {
    const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf-8')
    return cmdline.split('\0').slice(1).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * Get process command line arguments
 */
export function getProcessArgs(pid: number): string[] {
  const platform = os.platform()

  if (platform === 'darwin') {
    return getProcessArgsMac(pid)
  } else if (platform === 'linux') {
    return getProcessArgsLinux(pid)
  }

  return []
}

/**
 * Check if a process is an Electron app
 */
export function isElectronProcess(proc: ProcessInfo): boolean {
  const name = proc.name.toLowerCase()

  // Common Electron app indicators
  const electronIndicators = [
    'electron',
    // Specific known Electron apps
    'code', // VS Code
    'cursor', // Cursor
    'slack',
    'discord',
    'figma',
    'notion',
    'obsidian',
    'postman',
    'insomnia',
    'spotify', // Desktop app (not web player)
    'teams',
    'whatsapp',
    'signal',
    'telegram',
    'atom',
    'bitwarden',
    '1password',
    'mongodb compass',
    'tableplus',
    'linear',
  ]

  if (electronIndicators.some((ind) => name.includes(ind))) {
    return true
  }

  // Check command line for Electron indicators
  const args = getProcessArgs(proc.pid)
  const fullCommand = [proc.command, ...args].join(' ').toLowerCase()

  return (
    fullCommand.includes('electron') ||
    fullCommand.includes('--type=renderer') ||
    fullCommand.includes('--type=gpu-process')
  )
}

/**
 * Check if a process is a Chromium-based browser
 */
export function isChromiumProcess(proc: ProcessInfo): boolean {
  const name = proc.name.toLowerCase()

  const chromiumIndicators = [
    'chrome',
    'chromium',
    'brave',
    'edge',
    'opera',
    'vivaldi',
    'arc',
  ]

  return chromiumIndicators.some((ind) => name.includes(ind))
}

/**
 * Find CDP port from process arguments
 */
export function findCDPPortFromArgs(pid: number): number | undefined {
  const args = getProcessArgs(pid)

  for (const arg of args) {
    const match = arg.match(/--remote-debugging-port=(\d+)/)
    if (match) {
      return parseInt(match[1], 10)
    }
  }

  return undefined
}

/**
 * Try to find an existing CDP port for an app
 */
export async function probeCDPPort(
  startPort = 9222,
  endPort = 9322
): Promise<number | undefined> {
  for (let port = startPort; port <= endPort; port++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`, {
        signal: AbortSignal.timeout(500),
      })
      if (res.ok) {
        return port
      }
    } catch {
      // Port not available
    }
  }

  return undefined
}

/**
 * Get app bundle ID on macOS
 */
function getBundleIdMac(appPath: string): string | undefined {
  try {
    // For .app bundles
    if (appPath.endsWith('.app')) {
      const plistPath = join(appPath, 'Contents', 'Info.plist')
      if (existsSync(plistPath)) {
        const output = execSync(`/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "${plistPath}"`, {
          encoding: 'utf-8',
        })
        return output.trim()
      }
    }
  } catch {
    // Ignore
  }

  return undefined
}

/**
 * Get app path on macOS from PID
 */
function getAppPathMac(pid: number): string | undefined {
  try {
    const output = execSync(`lsof -p ${pid} -Fn | grep "^n/" | head -1`, {
      encoding: 'utf-8',
    })
    const path = output.trim().replace(/^n/, '')

    // Find the .app bundle
    const appMatch = path.match(/^(.+\.app)/)
    if (appMatch) {
      return appMatch[1]
    }

    return path
  } catch {
    return undefined
  }
}

/**
 * Discover a specific app by PID
 */
export async function discoverAppByPid(pid: number): Promise<DiscoveredApp | null> {
  const processes = listProcesses()
  const proc = processes.find((p) => p.pid === pid)

  if (!proc) return null

  let type: AppType = 'unknown'
  if (isElectronProcess(proc)) {
    type = 'electron'
  } else if (isChromiumProcess(proc)) {
    type = 'chromium'
  } else {
    type = 'native'
  }

  const app: DiscoveredApp = {
    pid,
    name: proc.name,
    type,
  }

  // Get app path on macOS
  if (os.platform() === 'darwin') {
    app.path = getAppPathMac(pid)
    if (app.path) {
      app.bundleId = getBundleIdMac(app.path)
    }
  }

  // Look for CDP port
  app.cdpPort = findCDPPortFromArgs(pid)

  // Get main args
  app.mainArgs = getProcessArgs(pid)

  return app
}

/**
 * Discover all running Electron/Chromium apps
 */
export async function discoverElectronApps(): Promise<DiscoveredApp[]> {
  const processes = listProcesses()
  const apps: DiscoveredApp[] = []
  const seen = new Set<number>()

  for (const proc of processes) {
    if (seen.has(proc.pid)) continue

    if (isElectronProcess(proc) || isChromiumProcess(proc)) {
      const app = await discoverAppByPid(proc.pid)
      if (app) {
        apps.push(app)
        seen.add(proc.pid)
      }
    }
  }

  return apps
}

/**
 * Find app by name (partial match)
 */
export async function findAppByName(name: string): Promise<DiscoveredApp | null> {
  const processes = listProcesses()
  const nameLower = name.toLowerCase()

  for (const proc of processes) {
    if (proc.name.toLowerCase().includes(nameLower)) {
      return discoverAppByPid(proc.pid)
    }
  }

  return null
}

/**
 * Launch an app with CDP enabled on macOS
 */
export async function launchAppWithCDP(
  bundleIdOrPath: string,
  cdpPort = 9222
): Promise<DiscoveredApp | null> {
  const platform = os.platform()

  if (platform !== 'darwin') {
    throw new Error('App launching only supported on macOS currently')
  }

  try {
    // Determine if it's a bundle ID or path
    const isPath = bundleIdOrPath.includes('/')

    if (isPath) {
      // Launch directly with arguments
      const args = [
        bundleIdOrPath,
        '--args',
        `--remote-debugging-port=${cdpPort}`,
      ]
      spawn('open', args, { detached: true, stdio: 'ignore' }).unref()
    } else {
      // Launch by bundle ID
      const args = [
        '-b', bundleIdOrPath,
        '--args',
        `--remote-debugging-port=${cdpPort}`,
      ]
      spawn('open', args, { detached: true, stdio: 'ignore' }).unref()
    }

    // Wait for app to start and CDP to be available
    await new Promise((r) => setTimeout(r, 3000))

    // Find the launched app
    const apps = await discoverElectronApps()
    return apps.find((a) => a.cdpPort === cdpPort) || null
  } catch {
    return null
  }
}
