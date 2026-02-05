/**
 * Skill installer - executes install instructions for skills
 */

import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import type {
  InstallInstruction,
  InstallResult,
  SetupResult,
  Skill,
  BrewInstallInstruction,
  AptInstallInstruction,
  GoInstallInstruction,
  NodeInstallInstruction,
  UvInstallInstruction,
  PipInstallInstruction,
  CargoInstallInstruction,
  DownloadInstallInstruction,
  ManualInstallInstruction,
} from './types.js'
import {
  isBrewAvailable,
  isAptAvailable,
  isGoAvailable,
  isNodeAvailable,
  isUvAvailable,
  isPipAvailable,
  isCargoAvailable,
  checkBinaryExists,
  replacePlatformPlaceholders,
  getAvailablePackageManagers,
} from './utils.js'

const execAsync = promisify(exec)

/**
 * Execute a shell command and return output
 */
async function runCommand(
  command: string,
  options: { timeout?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const { timeout = 300000 } = options // 5 minute default timeout

  try {
    const result = await execAsync(command, {
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })
    return result
  } catch (error) {
    const execError = error as { stdout?: string; stderr?: string; message?: string }
    throw new Error(execError.stderr || execError.message || 'Command failed')
  }
}

/**
 * Install via Homebrew
 */
async function installBrew(inst: BrewInstallInstruction): Promise<InstallResult> {
  if (!isBrewAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'Homebrew is not installed. Install from https://brew.sh',
    }
  }

  try {
    let output = ''

    // Add tap if specified
    if (inst.tap) {
      const tapResult = await runCommand(`brew tap ${inst.tap}`)
      output += `Tapped ${inst.tap}\n${tapResult.stdout}\n`
    }

    // Install formula or cask
    const installCmd = inst.cask ? `brew install --cask ${inst.formula}` : `brew install ${inst.formula}`

    const installResult = await runCommand(installCmd)
    output += installResult.stdout

    // Verify binaries are now available
    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output,
      installedBins,
      error: installedBins.length === 0 ? 'Install completed but binaries not found in PATH' : undefined,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'Brew install failed',
    }
  }
}

/**
 * Install via APT
 */
async function installApt(inst: AptInstallInstruction): Promise<InstallResult> {
  if (!isAptAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'APT is not available on this system',
    }
  }

  try {
    let output = ''

    // Add PPA if specified
    if (inst.ppa) {
      const ppaResult = await runCommand(`sudo add-apt-repository -y ${inst.ppa}`)
      output += `Added PPA ${inst.ppa}\n${ppaResult.stdout}\n`

      const updateResult = await runCommand('sudo apt-get update')
      output += updateResult.stdout
    }

    // Install package
    const installResult = await runCommand(`sudo apt-get install -y ${inst.package}`)
    output += installResult.stdout

    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output,
      installedBins,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'APT install failed',
    }
  }
}

/**
 * Install via Go
 */
async function installGo(inst: GoInstallInstruction): Promise<InstallResult> {
  if (!isGoAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'Go is not installed. Install from https://go.dev/dl/',
    }
  }

  try {
    const installResult = await runCommand(`go install ${inst.module}`)
    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output: installResult.stdout,
      installedBins,
      error:
        installedBins.length === 0 ? 'Install completed but binaries not found. Check GOPATH/bin is in PATH.' : undefined,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'Go install failed',
    }
  }
}

/**
 * Install via Node/npm
 */
async function installNode(inst: NodeInstallInstruction): Promise<InstallResult> {
  if (!isNodeAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'Node.js/npm is not installed',
    }
  }

  try {
    // Prefer pnpm > bun > npm
    let pm = 'npm'
    if (checkBinaryExists('pnpm')) pm = 'pnpm'
    else if (checkBinaryExists('bun')) pm = 'bun'

    const globalFlag = inst.global !== false ? '-g' : ''
    const installResult = await runCommand(`${pm} install ${globalFlag} ${inst.package}`)
    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output: installResult.stdout,
      installedBins,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'Node install failed',
    }
  }
}

/**
 * Install via Python uv
 */
async function installUv(inst: UvInstallInstruction): Promise<InstallResult> {
  if (!isUvAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'uv is not installed. Install from https://docs.astral.sh/uv/',
    }
  }

  try {
    const cmd = inst.tool ? `uv tool install ${inst.package}` : `uv pip install ${inst.package}`
    const installResult = await runCommand(cmd)
    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output: installResult.stdout,
      installedBins,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'uv install failed',
    }
  }
}

/**
 * Install via pip
 */
async function installPip(inst: PipInstallInstruction): Promise<InstallResult> {
  if (!isPipAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'pip is not installed',
    }
  }

  try {
    const pip = checkBinaryExists('pip3') ? 'pip3' : 'pip'
    const installResult = await runCommand(`${pip} install ${inst.package}`)
    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output: installResult.stdout,
      installedBins,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'pip install failed',
    }
  }
}

/**
 * Install via Cargo
 */
async function installCargo(inst: CargoInstallInstruction): Promise<InstallResult> {
  if (!isCargoAvailable()) {
    return {
      success: false,
      instruction: inst,
      error: 'Cargo is not installed. Install from https://rustup.rs/',
    }
  }

  try {
    const installResult = await runCommand(`cargo install ${inst.crate}`)
    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output: installResult.stdout,
      installedBins,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'Cargo install failed',
    }
  }
}

/**
 * Install via download
 */
async function installDownload(inst: DownloadInstallInstruction): Promise<InstallResult> {
  try {
    const url = replacePlatformPlaceholders(inst.url)
    const target = inst.target ? replacePlatformPlaceholders(inst.target) : '/usr/local/bin'

    // Download using curl
    const filename = url.split('/').pop() || 'download'
    const downloadResult = await runCommand(`curl -fsSL -o /tmp/${filename} "${url}"`)
    let output = downloadResult.stdout

    // Run post-install commands if specified
    if (inst.postInstall && inst.postInstall.length > 0) {
      for (const cmd of inst.postInstall) {
        const postResult = await runCommand(replacePlatformPlaceholders(cmd))
        output += postResult.stdout
      }
    }

    const installedBins = inst.bins.filter((bin) => checkBinaryExists(bin))

    return {
      success: installedBins.length > 0,
      instruction: inst,
      output,
      installedBins,
    }
  } catch (error) {
    return {
      success: false,
      instruction: inst,
      error: error instanceof Error ? error.message : 'Download install failed',
    }
  }
}

/**
 * Handle manual install (just return instructions)
 */
function installManual(inst: ManualInstallInstruction): InstallResult {
  return {
    success: false,
    instruction: inst,
    error: `Manual installation required:\n${inst.instructions}${inst.url ? `\n\nMore info: ${inst.url}` : ''}`,
  }
}

/**
 * Execute an install instruction
 */
export async function executeInstall(instruction: InstallInstruction): Promise<InstallResult> {
  switch (instruction.kind) {
    case 'brew':
      return installBrew(instruction)
    case 'apt':
      return installApt(instruction)
    case 'go':
      return installGo(instruction)
    case 'node':
      return installNode(instruction)
    case 'uv':
      return installUv(instruction)
    case 'pip':
      return installPip(instruction)
    case 'cargo':
      return installCargo(instruction)
    case 'download':
      return installDownload(instruction)
    case 'manual':
      return installManual(instruction)
    default:
      return {
        success: false,
        instruction,
        error: `Unknown install kind: ${(instruction as InstallInstruction).kind}`,
      }
  }
}

/**
 * Find the best install instruction for the current system
 */
export function findBestInstallOption(instructions: InstallInstruction[]): InstallInstruction | undefined {
  const availableManagers = getAvailablePackageManagers()

  // Priority order: brew > apt > go > node > uv > pip > cargo > download > manual
  const priority = ['brew', 'apt', 'go', 'node', 'uv', 'pip', 'cargo', 'download', 'manual']

  for (const kind of priority) {
    const matching = instructions.find((inst) => inst.kind === kind && availableManagers.includes(kind))
    if (matching) {
      return matching
    }
  }

  // Fall back to download or manual if no package manager available
  return instructions.find((inst) => inst.kind === 'download' || inst.kind === 'manual')
}

/**
 * Install a skill's dependencies using the best available method
 */
export async function installSkillDependencies(skill: Skill): Promise<InstallResult | null> {
  if (!skill.metadata.install || skill.metadata.install.length === 0) {
    return null
  }

  const bestOption = findBestInstallOption(skill.metadata.install)
  if (!bestOption) {
    return {
      success: false,
      instruction: skill.metadata.install[0]!,
      error: 'No compatible install method found for this system',
    }
  }

  return executeInstall(bestOption)
}

/**
 * Run skill setup commands
 */
export async function runSkillSetup(skill: Skill): Promise<SetupResult> {
  const setup = skill.metadata.setup

  if (!setup) {
    return { success: true }
  }

  // Check if interactive setup is needed
  if (setup.interactive) {
    return {
      success: false,
      needsInteractive: true,
      interactiveInstructions: setup.instructions,
    }
  }

  // Run setup commands
  if (setup.commands && setup.commands.length > 0) {
    try {
      let output = ''
      for (const cmd of setup.commands) {
        const result = await runCommand(cmd)
        output += result.stdout + '\n'
      }
      return { success: true, output }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Setup failed',
      }
    }
  }

  return { success: true }
}

/**
 * Full skill setup: install dependencies + run setup
 */
export async function setupSkill(skill: Skill): Promise<{
  install: InstallResult | null
  setup: SetupResult
}> {
  // Install dependencies first
  const installResult = await installSkillDependencies(skill)

  // If install failed, don't run setup
  if (installResult && !installResult.success) {
    return {
      install: installResult,
      setup: { success: false, error: 'Skipped due to install failure' },
    }
  }

  // Run setup
  const setupResult = await runSkillSetup(skill)

  return {
    install: installResult,
    setup: setupResult,
  }
}
