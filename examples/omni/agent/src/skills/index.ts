/**
 * Skills system exports
 */

// Types
export type {
  Skill,
  SkillFrontmatter,
  SkillMetadata,
  SkillRequirements,
  SkillLoadOptions,
  SkillSnapshot,
  SkillEligibility,
  InstallInstruction,
  InstallResult,
  SetupResult,
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

// Loader
export {
  loadSkillsFromDir,
  loadSkills,
  checkSkillEligibility,
  formatSkillsForPrompt,
  buildSkillSnapshot,
  getSkill,
  listSkills,
} from './loader.js'

// Installer
export {
  executeInstall,
  findBestInstallOption,
  installSkillDependencies,
  runSkillSetup,
  setupSkill,
} from './installer.js'

// Utils
export {
  checkBinaryExists,
  getCurrentPlatform,
  getCurrentArch,
  isBrewAvailable,
  isAptAvailable,
  isGoAvailable,
  isNodeAvailable,
  isUvAvailable,
  isPipAvailable,
  isCargoAvailable,
  getAvailablePackageManagers,
  replacePlatformPlaceholders,
} from './utils.js'

// Seed data utilities (for table operations)
export {
  skillToRow,
  isSeeded,
  getSkillFromTable as getSkillFromSeedTable,
  searchSkills as searchSeedSkills,
  listSkillsFromTable as listSeedSkillsFromTable,
} from './seed-data.js'

// Sync from local-plane
export {
  syncSkillsFromLocalPlane,
  isSynced,
} from './sync.js'
export type { SyncResult, SkillData } from './sync.js'

// Table-based skill loading
export {
  rowToSkill,
  checkTableSkillEligibility,
  loadSkillsFromTable,
  getSkillFromTable,
  searchSkillsFromTable,
  formatTableSkillsForPrompt,
  buildTableSkillSnapshot,
  listSkillsFromTable,
} from './table-loader.js'
