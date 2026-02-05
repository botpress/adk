/**
 * Skill types for the omni agent
 *
 * Skills are markdown-based prompt injections that teach the agent
 * how to use external tools, CLIs, or APIs. They include metadata
 * for auto-installation and setup.
 */

// =============================================================================
// Install Types
// =============================================================================

/**
 * Base install instruction
 */
export type BaseInstallInstruction = {
  /** Unique identifier for this install option */
  id: string
  /** Human-readable label */
  label: string
  /** Binaries this install provides */
  bins: string[]
}

/**
 * Homebrew install (macOS/Linux)
 */
export type BrewInstallInstruction = BaseInstallInstruction & {
  kind: 'brew'
  /** Formula name (e.g., "gh" or "openhue/cli/openhue-cli") */
  formula: string
  /** Optional tap to add first (e.g., "steipete/tap") */
  tap?: string
  /** Install as cask instead of formula */
  cask?: boolean
}

/**
 * APT install (Debian/Ubuntu)
 */
export type AptInstallInstruction = BaseInstallInstruction & {
  kind: 'apt'
  /** Package name */
  package: string
  /** Optional PPA to add first */
  ppa?: string
}

/**
 * Go install
 */
export type GoInstallInstruction = BaseInstallInstruction & {
  kind: 'go'
  /** Module path (e.g., "github.com/user/repo/cmd/cli@latest") */
  module: string
}

/**
 * Node/npm install
 */
export type NodeInstallInstruction = BaseInstallInstruction & {
  kind: 'node'
  /** Package name */
  package: string
  /** Install globally (default: true) */
  global?: boolean
}

/**
 * Python uv install
 */
export type UvInstallInstruction = BaseInstallInstruction & {
  kind: 'uv'
  /** Package name */
  package: string
  /** Install as tool (uv tool install) */
  tool?: boolean
}

/**
 * Pip install
 */
export type PipInstallInstruction = BaseInstallInstruction & {
  kind: 'pip'
  /** Package name */
  package: string
}

/**
 * Cargo install (Rust)
 */
export type CargoInstallInstruction = BaseInstallInstruction & {
  kind: 'cargo'
  /** Crate name */
  crate: string
}

/**
 * Direct download
 */
export type DownloadInstallInstruction = BaseInstallInstruction & {
  kind: 'download'
  /** Download URL (can include {arch}, {os} placeholders) */
  url: string
  /** Target path to install to */
  target?: string
  /** Post-download commands */
  postInstall?: string[]
}

/**
 * Manual install (instructions only)
 */
export type ManualInstallInstruction = BaseInstallInstruction & {
  kind: 'manual'
  /** Instructions for manual installation */
  instructions: string
  /** URL with more info */
  url?: string
}

/**
 * Union of all install instruction types
 */
export type InstallInstruction =
  | BrewInstallInstruction
  | AptInstallInstruction
  | GoInstallInstruction
  | NodeInstallInstruction
  | UvInstallInstruction
  | PipInstallInstruction
  | CargoInstallInstruction
  | DownloadInstallInstruction
  | ManualInstallInstruction

// =============================================================================
// Requirements
// =============================================================================

/**
 * Skill requirements specification
 */
export type SkillRequirements = {
  /** All of these binaries must exist */
  bins?: string[]
  /** Any one of these binaries must exist */
  anyBins?: string[]
  /** Required environment variables */
  envVars?: string[]
  /** Required platform (darwin, linux, win32) */
  platform?: string | string[]
}

// =============================================================================
// Skill Metadata
// =============================================================================

/**
 * Omni-specific skill metadata
 */
export type SkillMetadata = {
  /** Emoji for display */
  emoji?: string
  /** Requirements for this skill */
  requires?: SkillRequirements
  /** Install instructions (ordered by preference) */
  install?: InstallInstruction[]
  /** Setup instructions (run after install) */
  setup?: {
    /** Commands to run for setup */
    commands?: string[]
    /** Interactive setup required */
    interactive?: boolean
    /** Setup instructions text */
    instructions?: string
  }
  /** Primary environment (local, remote, both) */
  primaryEnv?: 'local' | 'remote' | 'both'
}

/**
 * Parsed frontmatter from a SKILL.md file
 */
export type SkillFrontmatter = {
  /** Skill name (defaults to directory name) */
  name?: string
  /** Human-readable description */
  description?: string
  /** Homepage URL for the skill/tool */
  homepage?: string
  /** Omni-specific metadata */
  metadata?: {
    omni?: SkillMetadata
  }
  /** Tags for categorization */
  tags?: string[]
  /** Whether the skill can be invoked by users via /command */
  userInvocable?: boolean
  /** Whether to include in model prompt (default: true) */
  includeInPrompt?: boolean
  /** Priority for ordering in prompt (higher = first) */
  priority?: number
}

// =============================================================================
// Loaded Skill
// =============================================================================

/**
 * A loaded skill
 */
export type Skill = {
  /** Unique skill name */
  name: string
  /** Skill description */
  description?: string
  /** Path to the SKILL.md file */
  filePath: string
  /** Directory containing the skill */
  baseDir: string
  /** Parsed frontmatter */
  frontmatter: SkillFrontmatter
  /** Resolved metadata (with defaults) */
  metadata: SkillMetadata
  /** Raw markdown content (without frontmatter) */
  content: string
  /** Full raw file content */
  rawContent: string
  /** Source location (bundled, workspace, custom) */
  source: string
}

/**
 * Skill eligibility check result
 */
export type SkillEligibility = {
  /** Whether the skill is eligible to use */
  eligible: boolean
  /** Missing requirements */
  missingBins?: string[]
  missingEnvVars?: string[]
  /** Platform mismatch */
  platformMismatch?: boolean
  /** Available install options for missing bins */
  availableInstalls?: InstallInstruction[]
}

/**
 * Skill loading options
 */
export type SkillLoadOptions = {
  /** Directories to load skills from */
  skillDirs?: string[]
  /** Filter to specific skill names */
  skillFilter?: string[]
  /** Check if required binaries exist */
  checkRequirements?: boolean
  /** Include ineligible skills (for listing/install) */
  includeIneligible?: boolean
}

/**
 * Skill snapshot for prompt injection
 */
export type SkillSnapshot = {
  /** Formatted prompt content */
  prompt: string
  /** List of loaded skills with eligibility */
  skills: Array<{
    name: string
    description?: string
    eligible: boolean
    eligibility?: SkillEligibility
  }>
  /** Number of eligible skills */
  eligibleCount: number
  /** Total skills loaded */
  totalCount: number
}

// =============================================================================
// Install Result
// =============================================================================

/**
 * Result of an install attempt
 */
export type InstallResult = {
  success: boolean
  /** Install instruction that was used */
  instruction: InstallInstruction
  /** Output from install commands */
  output?: string
  /** Error message if failed */
  error?: string
  /** Binaries that are now available */
  installedBins?: string[]
}

/**
 * Result of a setup attempt
 */
export type SetupResult = {
  success: boolean
  /** Output from setup commands */
  output?: string
  /** Error message if failed */
  error?: string
  /** Whether interactive setup is needed */
  needsInteractive?: boolean
  /** Instructions for interactive setup */
  interactiveInstructions?: string
}
