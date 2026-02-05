/**
 * Omni ADK Package - Multi-agent system with tool and agent registries
 *
 * This module bootstraps the omni agent system by registering all tools
 * and agents. Import this module to ensure everything is properly initialized.
 */

// Tool definitions
import { bashToolDef } from './tools/definitions/bash.js'
import { fileReadToolDef } from './tools/definitions/file-read.js'
import { fileWriteToolDef } from './tools/definitions/file-write.js'
import { fileEditToolDef } from './tools/definitions/file-edit.js'
import { fileGrepToolDef } from './tools/definitions/file-grep.js'
import { fileGlobToolDef } from './tools/definitions/file-glob.js'
import { fileLsToolDef } from './tools/definitions/file-ls.js'
import { contextLoadToolDef } from './tools/definitions/context.js'
import { memoryReadToolDef, memoryWriteToolDef } from './tools/definitions/memory.js'
import { delegateToolDef } from './tools/definitions/delegate.js'
import {
  skillListToolDef,
  skillInfoToolDef,
  skillInstallToolDef,
  skillSetupToolDef,
  skillPromptToolDef,
} from './tools/definitions/skill-manager.js'

// Process/PTY tools
import {
  processSpawnToolDef,
  processSendKeysToolDef,
  processReadToolDef,
  processKillToolDef,
  processListToolDef,
  processResizeToolDef,
} from './tools/definitions/process.js'

// Browser automation tools
import {
  browserLaunchToolDef,
  browserNavigateToolDef,
  browserClickToolDef,
  browserTypeToolDef,
  browserScreenshotToolDef,
  browserExtractToolDef,
  browserExecuteToolDef,
  browserWaitToolDef,
  browserCloseToolDef,
} from './tools/definitions/browser.js'

// Introspection tools (app discovery, CDP)
import {
  appDiscoverToolDef,
  cdpConnectToolDef,
  cdpEvaluateToolDef,
  cdpDomToolDef,
  cdpTargetsToolDef,
  cdpCloseToolDef,
  moduleTraverseToolDef,
  storeDiscoverToolDef,
  reactInspectToolDef,
  ipcEnumerateToolDef,
} from './tools/definitions/introspect/index.js'

// Instrumentation tools (hooking, injection)
import {
  functionHookToolDef,
  functionReplaceToolDef,
  ipcInterceptToolDef,
  stateSubscribeToolDef,
  injectScriptToolDef,
  removeHookToolDef,
  listHooksToolDef,
} from './tools/definitions/instrument/index.js'

// Skill generation tools
import {
  skillDraftToolDef,
  skillUpsertToolDef,
  skillQueryToolDef,
  skillGetToolDef,
} from './tools/definitions/skill-gen/index.js'

// App automation tools (executable automation scripts)
import {
  automationUpsertToolDef,
  automationQueryToolDef,
  automationGetToolDef,
  automationRunToolDef,
} from './tools/definitions/app-automation/index.js'

// Frida tools (native process instrumentation)
import {
  fridaProcessListToolDef,
  fridaAttachToolDef,
  fridaSpawnToolDef,
  fridaDetachToolDef,
  fridaListSessionsToolDef,
  fridaModulesToolDef,
  fridaExportsToolDef,
  fridaClassesToolDef,
  fridaInterceptToolDef,
  fridaReplaceToolDef,
  fridaCallToolDef,
  fridaRemoveHookToolDef,
  fridaListHooksToolDef,
  fridaScriptToolDef,
  fridaUnloadScriptToolDef,
  fridaEvaluateToolDef,
  fridaMemoryReadToolDef,
  fridaMemoryWriteToolDef,
} from './tools/definitions/frida/index.js'

// Agent definitions
import { mainAgent } from './agents/definitions/main.js'
import { coderAgent } from './agents/definitions/coder.js'
import { researchAgent } from './agents/definitions/research.js'
import { homeAgent } from './agents/definitions/home.js'
import { browserAgent } from './agents/definitions/browser.js'
import { extractorAgent } from './agents/definitions/extractor.js'
import { appEngineerAgent } from './agents/definitions/app-engineer.js'

// Registries
import { registerTool, clearToolRegistry } from './tools/registry.js'
import { registerAgent, clearAgentRegistry } from './agents/registry.js'

// Skills sync (skills are now fetched from local-plane)
import { syncSkillsFromLocalPlane, isSynced } from './skills/sync.js'

/**
 * Register all built-in tools
 */
function registerBuiltInTools(): void {
  // Core local tools
  registerTool(bashToolDef)
  registerTool(fileReadToolDef)
  registerTool(fileWriteToolDef)
  registerTool(fileEditToolDef)
  registerTool(fileGrepToolDef)
  registerTool(fileGlobToolDef)
  registerTool(fileLsToolDef)
  registerTool(contextLoadToolDef)
  registerTool(memoryReadToolDef)
  registerTool(memoryWriteToolDef)
  registerTool(delegateToolDef)

  // Skill management tools
  registerTool(skillListToolDef)
  registerTool(skillInfoToolDef)
  registerTool(skillInstallToolDef)
  registerTool(skillSetupToolDef)
  registerTool(skillPromptToolDef)

  // Process/PTY tools
  registerTool(processSpawnToolDef)
  registerTool(processSendKeysToolDef)
  registerTool(processReadToolDef)
  registerTool(processKillToolDef)
  registerTool(processListToolDef)
  registerTool(processResizeToolDef)

  // Browser automation tools
  registerTool(browserLaunchToolDef)
  registerTool(browserNavigateToolDef)
  registerTool(browserClickToolDef)
  registerTool(browserTypeToolDef)
  registerTool(browserScreenshotToolDef)
  registerTool(browserExtractToolDef)
  registerTool(browserExecuteToolDef)
  registerTool(browserWaitToolDef)
  registerTool(browserCloseToolDef)

  // Introspection tools
  registerTool(appDiscoverToolDef)
  registerTool(cdpConnectToolDef)
  registerTool(cdpEvaluateToolDef)
  registerTool(cdpDomToolDef)
  registerTool(cdpTargetsToolDef)
  registerTool(cdpCloseToolDef)
  registerTool(moduleTraverseToolDef)
  registerTool(storeDiscoverToolDef)
  registerTool(reactInspectToolDef)
  registerTool(ipcEnumerateToolDef)

  // Instrumentation tools
  registerTool(functionHookToolDef)
  registerTool(functionReplaceToolDef)
  registerTool(ipcInterceptToolDef)
  registerTool(stateSubscribeToolDef)
  registerTool(injectScriptToolDef)
  registerTool(removeHookToolDef)
  registerTool(listHooksToolDef)

  // Skill generation tools
  registerTool(skillDraftToolDef)
  registerTool(skillUpsertToolDef)
  registerTool(skillQueryToolDef)
  registerTool(skillGetToolDef)

  // App automation tools
  registerTool(automationUpsertToolDef)
  registerTool(automationQueryToolDef)
  registerTool(automationGetToolDef)
  registerTool(automationRunToolDef)

  // Frida tools (native process instrumentation)
  registerTool(fridaProcessListToolDef)
  registerTool(fridaAttachToolDef)
  registerTool(fridaSpawnToolDef)
  registerTool(fridaDetachToolDef)
  registerTool(fridaListSessionsToolDef)
  registerTool(fridaModulesToolDef)
  registerTool(fridaExportsToolDef)
  registerTool(fridaClassesToolDef)
  registerTool(fridaInterceptToolDef)
  registerTool(fridaReplaceToolDef)
  registerTool(fridaCallToolDef)
  registerTool(fridaRemoveHookToolDef)
  registerTool(fridaListHooksToolDef)
  registerTool(fridaScriptToolDef)
  registerTool(fridaUnloadScriptToolDef)
  registerTool(fridaEvaluateToolDef)
  registerTool(fridaMemoryReadToolDef)
  registerTool(fridaMemoryWriteToolDef)
}

/**
 * Register all built-in agents
 */
function registerBuiltInAgents(): void {
  registerAgent(mainAgent)
  registerAgent(coderAgent)
  registerAgent(researchAgent)
  registerAgent(homeAgent)
  registerAgent(browserAgent)
  registerAgent(extractorAgent)
  registerAgent(appEngineerAgent)
}

/**
 * Bootstrap the omni agent system
 *
 * Call this once at application startup to register all tools and agents.
 * It's safe to call multiple times (uses a flag to prevent double-registration).
 */
let bootstrapped = false

export function bootstrap(): void {
  if (bootstrapped) {
    return
  }

  registerBuiltInTools()
  registerBuiltInAgents()
  bootstrapped = true
}

/**
 * Reset the bootstrap state (for testing)
 */
export function resetBootstrap(): void {
  clearToolRegistry()
  clearAgentRegistry()
  bootstrapped = false
}

/**
 * Ensure skills are synced from local-plane to the table
 *
 * This is now a no-op placeholder for backwards compatibility.
 * Skills are synced in the conversation handler with proper config.
 *
 * @deprecated Use syncSkillsFromLocalPlane directly in handlers with proper config
 */
export async function ensureSkillsSeeded(): Promise<void> {
  // Skills are now synced in conversation handlers with local-plane config
  // This function exists for backwards compatibility but does nothing
  // The actual sync happens in conversations/main.ts with proper config
}


// Re-export public API

// Tool registry
export {
  registerTool,
  getTool,
  getAllTools,
  listToolNames,
  hasToolRegistered,
  createToolsForAgent,
  getToolsByGroup,
  getRegistrySummary as getToolRegistrySummary,
  TOOL_GROUPS,
  TOOL_PROFILES,
  expandGroups,
  isToolAllowed,
  filterToolsByPolicy,
} from './tools/registry.js'

// Tool types
export type { ToolContext, ToolFactory, ToolDefinition, ToolPolicy } from './tools/types.js'

// Agent registry
export {
  registerAgent,
  getAgent,
  getAllAgents,
  listAgentIds,
  listAgentsForToolDescription,
  hasAgentRegistered,
  resolveAgentInstructions,
  getAgentsByTag,
  getRegistrySummary as getAgentRegistrySummary,
} from './agents/registry.js'

// Agent types
export type { AgentDefinition, AgentContext, DelegateResult, DelegationPolicy } from './agents/types.js'

// Bridge client
export { callLocalPlane, pingLocalPlane, LocalPlaneError } from './bridge/client.js'
export type { LocalPlaneResponse } from './bridge/client.js'

// Conversation handler (MainConversation is auto-discovered by ADK from src/conversations/main.ts)
export { handleMainConversation } from './conversations/main.js'
export type { ConversationConfig, ConversationState, HandlerContext } from './conversations/main.js'

// Prompts
export {
  buildDelegationPrompt,
  buildSystemHeader,
  formatToolOutput,
  buildFileContextSummary,
  TASK_COMPLETE_FORMAT,
  ERROR_HANDLING_FORMAT,
  CONTEXT_LOADING_PREAMBLE,
  CODE_REVIEW_GUIDELINES,
  CODING_BEST_PRACTICES,
} from './lib/prompts.js'

// Tool definitions (for extending)
export { bashToolDef } from './tools/definitions/bash.js'
export { fileReadToolDef } from './tools/definitions/file-read.js'
export { fileWriteToolDef } from './tools/definitions/file-write.js'
export { fileEditToolDef } from './tools/definitions/file-edit.js'
export { fileGrepToolDef } from './tools/definitions/file-grep.js'
export { fileGlobToolDef } from './tools/definitions/file-glob.js'
export { fileLsToolDef } from './tools/definitions/file-ls.js'
export { contextLoadToolDef } from './tools/definitions/context.js'
export { memoryReadToolDef, memoryWriteToolDef } from './tools/definitions/memory.js'
export {
  delegateToolDef,
  createDelegateToolWithExecute,
  createDelegateToolWithNestedSupport,
  getAvailableAgentsForDelegation,
} from './tools/definitions/delegate.js'
export type { DelegateExecuteFn, DelegateContext } from './tools/definitions/delegate.js'

// Process tool definitions
export {
  processSpawnToolDef,
  processSendKeysToolDef,
  processReadToolDef,
  processKillToolDef,
  processListToolDef,
  processResizeToolDef,
} from './tools/definitions/process.js'

// Browser tool definitions
export {
  browserLaunchToolDef,
  browserNavigateToolDef,
  browserClickToolDef,
  browserTypeToolDef,
  browserScreenshotToolDef,
  browserExtractToolDef,
  browserExecuteToolDef,
  browserWaitToolDef,
  browserCloseToolDef,
} from './tools/definitions/browser.js'

// Introspection tool definitions
export {
  appDiscoverToolDef,
  cdpConnectToolDef,
  cdpEvaluateToolDef,
  cdpDomToolDef,
  cdpTargetsToolDef,
  cdpCloseToolDef,
  moduleTraverseToolDef,
  storeDiscoverToolDef,
  reactInspectToolDef,
  ipcEnumerateToolDef,
} from './tools/definitions/introspect/index.js'

// Instrumentation tool definitions
export {
  functionHookToolDef,
  functionReplaceToolDef,
  ipcInterceptToolDef,
  stateSubscribeToolDef,
  injectScriptToolDef,
  removeHookToolDef,
  listHooksToolDef,
} from './tools/definitions/instrument/index.js'

// Skill generation tool definitions
export {
  skillDraftToolDef,
  skillUpsertToolDef,
  skillQueryToolDef,
  skillGetToolDef,
} from './tools/definitions/skill-gen/index.js'

// App automation tool definitions
export {
  automationUpsertToolDef,
  automationQueryToolDef,
  automationGetToolDef,
  automationRunToolDef,
} from './tools/definitions/app-automation/index.js'

// Frida tool definitions (native process instrumentation)
export {
  fridaProcessListToolDef,
  fridaAttachToolDef,
  fridaSpawnToolDef,
  fridaDetachToolDef,
  fridaListSessionsToolDef,
  fridaModulesToolDef,
  fridaExportsToolDef,
  fridaClassesToolDef,
  fridaInterceptToolDef,
  fridaReplaceToolDef,
  fridaCallToolDef,
  fridaRemoveHookToolDef,
  fridaListHooksToolDef,
  fridaScriptToolDef,
  fridaUnloadScriptToolDef,
  fridaEvaluateToolDef,
  fridaMemoryReadToolDef,
  fridaMemoryWriteToolDef,
} from './tools/definitions/frida/index.js'

// Agent definitions (for extending)
export { mainAgent } from './agents/definitions/main.js'
export { coderAgent } from './agents/definitions/coder.js'
export { researchAgent } from './agents/definitions/research.js'
export { homeAgent } from './agents/definitions/home.js'
export { browserAgent } from './agents/definitions/browser.js'
export { extractorAgent } from './agents/definitions/extractor.js'
export { appEngineerAgent } from './agents/definitions/app-engineer.js'

// Skill management tool definitions
export {
  skillListToolDef,
  skillInfoToolDef,
  skillInstallToolDef,
  skillSetupToolDef,
  skillPromptToolDef,
} from './tools/definitions/skill-manager.js'

// Skills system
export {
  // Loader
  loadSkillsFromDir,
  loadSkills,
  checkSkillEligibility,
  formatSkillsForPrompt,
  buildSkillSnapshot,
  getSkill,
  listSkills,
  // Installer
  executeInstall,
  findBestInstallOption,
  installSkillDependencies,
  runSkillSetup,
  setupSkill,
  // Utils
  checkBinaryExists,
  getCurrentPlatform,
  getCurrentArch,
  isBrewAvailable,
  isAptAvailable,
  isGoAvailable,
  isNodeAvailable,
  getAvailablePackageManagers,
} from './skills/index.js'

// Skill types
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
} from './skills/types.js'

// Table utilities (Tables are auto-discovered by ADK from tables/*.ts)
export {
  SkillSourceEnum,
  parseJsonArray,
  stringifyArray,
} from './tables/skills.js'

export type {
  SkillSource,
  SkillRow,
} from './tables/skills.js'

// App Automations table exports
export { InjectionTypeEnum } from './tables/app-automations.js'

export type { InjectionType, AppAutomationRow } from './tables/app-automations.js'

// Skill seed data and table loading
export {
  skillToRow,
  isSeeded,
  rowToSkill,
  checkTableSkillEligibility,
  loadSkillsFromTable,
  getSkillFromTable,
  searchSkillsFromTable,
  formatTableSkillsForPrompt,
  buildTableSkillSnapshot,
  listSkillsFromTable,
} from './skills/index.js'

// Skills sync (from local-plane)
export { syncSkillsFromLocalPlane, isSynced as isSkillsSynced } from './skills/sync.js'
export type { SyncResult as SkillsSyncResult, SkillData } from './skills/sync.js'

// Process/PTY utilities
export { parseSendKeys, validateSendKeys, describeSendKeys } from './process/send-keys.js'
export type {
  ProcessSession,
  ProcessSessionInfo,
  ProcessSpawnInput,
  ProcessSpawnOutput,
  ProcessSendKeysInput,
  ProcessSendKeysOutput,
  ProcessReadInput,
  ProcessReadOutput,
  ProcessKillInput,
  ProcessKillOutput,
  ProcessListInput,
  ProcessListOutput,
  ProcessResizeInput,
  ProcessResizeOutput,
} from './process/types.js'
