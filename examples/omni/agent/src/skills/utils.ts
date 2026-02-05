/**
 * Utility functions for the skills system
 */

import { execSync } from 'child_process'

/**
 * Check if a binary exists in PATH
 */
export function checkBinaryExists(bin: string): boolean {
  try {
    const cmd = process.platform === 'win32' ? `where ${bin}` : `which ${bin}`
    execSync(cmd, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Get the current platform in a normalized form
 */
export function getCurrentPlatform(): string {
  const platform = process.platform
  if (platform === 'darwin') return 'darwin'
  if (platform === 'linux') return 'linux'
  if (platform === 'win32') return 'win32'
  return platform
}

/**
 * Get the current architecture
 */
export function getCurrentArch(): string {
  const arch = process.arch
  if (arch === 'x64') return 'amd64'
  if (arch === 'arm64') return 'arm64'
  return arch
}

/**
 * Check if Homebrew is available
 */
export function isBrewAvailable(): boolean {
  return checkBinaryExists('brew')
}

/**
 * Check if apt is available
 */
export function isAptAvailable(): boolean {
  return checkBinaryExists('apt-get')
}

/**
 * Check if Go is available
 */
export function isGoAvailable(): boolean {
  return checkBinaryExists('go')
}

/**
 * Check if Node/npm is available
 */
export function isNodeAvailable(): boolean {
  return checkBinaryExists('npm') || checkBinaryExists('pnpm') || checkBinaryExists('bun')
}

/**
 * Check if Python uv is available
 */
export function isUvAvailable(): boolean {
  return checkBinaryExists('uv')
}

/**
 * Check if pip is available
 */
export function isPipAvailable(): boolean {
  return checkBinaryExists('pip') || checkBinaryExists('pip3')
}

/**
 * Check if Cargo is available
 */
export function isCargoAvailable(): boolean {
  return checkBinaryExists('cargo')
}

/**
 * Get available package managers on the current system
 */
export function getAvailablePackageManagers(): string[] {
  const managers: string[] = []

  if (isBrewAvailable()) managers.push('brew')
  if (isAptAvailable()) managers.push('apt')
  if (isGoAvailable()) managers.push('go')
  if (isNodeAvailable()) managers.push('node')
  if (isUvAvailable()) managers.push('uv')
  if (isPipAvailable()) managers.push('pip')
  if (isCargoAvailable()) managers.push('cargo')

  return managers
}

/**
 * Replace platform/arch placeholders in a string
 */
export function replacePlatformPlaceholders(input: string): string {
  const platform = getCurrentPlatform()
  const arch = getCurrentArch()

  return input
    .replace(/\{platform\}/g, platform)
    .replace(/\{os\}/g, platform)
    .replace(/\{arch\}/g, arch)
}
