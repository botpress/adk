/**
 * Tool system exports
 */

// Types
export type { ToolContext, ToolFactory, ToolDefinition, ToolPolicy } from './types.js'

// Registry
export {
  registerTool,
  getTool,
  getAllTools,
  listToolNames,
  hasToolRegistered,
  unregisterTool,
  clearToolRegistry,
  createToolsForAgent,
  getToolsByGroup,
  getRegistrySummary,
} from './registry.js'

// Policy
export { TOOL_GROUPS, TOOL_PROFILES, expandGroups, isToolAllowed, filterToolsByPolicy, mergePolicies } from './policy.js'

// Tool definitions
export { bashToolDef } from './definitions/bash.js'
export { fileReadToolDef } from './definitions/file-read.js'
export { fileWriteToolDef } from './definitions/file-write.js'
export { fileEditToolDef } from './definitions/file-edit.js'
export { fileGrepToolDef } from './definitions/file-grep.js'
export { fileGlobToolDef } from './definitions/file-glob.js'
export { fileLsToolDef } from './definitions/file-ls.js'
export { contextLoadToolDef } from './definitions/context.js'
export { memoryReadToolDef, memoryWriteToolDef } from './definitions/memory.js'
export { delegateToolDef, createDelegateToolWithExecute } from './definitions/delegate.js'

// Browser tools
export {
  browserLaunchToolDef,
  browserNavigateToolDef,
  browserSnapshotToolDef,
  browserClickToolDef,
  browserTypeToolDef,
  browserHoverToolDef,
  browserScrollToolDef,
  browserPressKeyToolDef,
  browserSelectOptionToolDef,
  browserScreenshotToolDef,
  browserExtractToolDef,
  browserExecuteToolDef,
  browserWaitToolDef,
  browserCloseToolDef,
  browserConsoleToolDef,
  browserErrorsToolDef,
  // Phase 1: Core Interactions
  browserDragToolDef,
  browserFillFormToolDef,
  browserDialogToolDef,
  // Phase 2: File Operations
  browserUploadToolDef,
  browserDownloadToolDef,
  browserPdfToolDef,
  // Phase 3: State & Storage
  browserCookiesGetToolDef,
  browserCookiesSetToolDef,
  browserCookiesClearToolDef,
  browserStorageGetToolDef,
  browserStorageSetToolDef,
  browserStorageClearToolDef,
  // Phase 4: Network & Debugging
  browserNetworkToolDef,
  browserResponseToolDef,
  browserTraceStartToolDef,
  browserTraceStopToolDef,
  // Phase 5: Environment Emulation
  browserEmulateDeviceToolDef,
  browserGeolocationToolDef,
  browserTimezoneToolDef,
  browserLocaleToolDef,
  browserOfflineToolDef,
  browserHeadersToolDef,
} from './definitions/browser.js'

// Frida tools (native process instrumentation)
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
} from './definitions/frida/index.js'
