/**
 * Frida Tools - Native process instrumentation via Frida
 *
 * These tools enable dynamic instrumentation of native (non-Electron) applications
 * using the Frida framework. They communicate with the local plane server which
 * manages Frida sessions on the user's machine.
 */

// Attachment tools
export {
  fridaProcessListToolDef,
  fridaAttachToolDef,
  fridaSpawnToolDef,
  fridaDetachToolDef,
  fridaListSessionsToolDef,
} from './frida-attach.js'

// Enumeration tools
export {
  fridaModulesToolDef,
  fridaExportsToolDef,
  fridaClassesToolDef,
} from './frida-enumerate.js'

// Interception tools
export {
  fridaInterceptToolDef,
  fridaReplaceToolDef,
  fridaCallToolDef,
  fridaRemoveHookToolDef,
  fridaListHooksToolDef,
} from './frida-intercept.js'

// Script and evaluation tools
export {
  fridaScriptToolDef,
  fridaUnloadScriptToolDef,
  fridaEvaluateToolDef,
  fridaMemoryReadToolDef,
  fridaMemoryWriteToolDef,
} from './frida-script.js'
