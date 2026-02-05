/**
 * Instrument Tools - Tools for hooking and instrumenting applications
 *
 * These tools enable the agent to hook functions, intercept IPC,
 * subscribe to state changes, and inject scripts into running apps.
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ Function Hook ============

const functionHookInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  target: z
    .string()
    .describe('Path to function (e.g., "window.fetch", "window.myApp.api.call")'),
  hookType: z
    .enum(['wrap', 'before', 'after', 'replace'])
    .default('wrap')
    .describe('Type of hook: wrap (full), before (pre-call), after (post-call)'),
  hookCode: z
    .string()
    .optional()
    .describe('JavaScript code for custom hook logic'),
  logCalls: z
    .boolean()
    .optional()
    .default(true)
    .describe('Log all calls to console'),
  hookId: z.string().optional().describe('Custom ID for this hook'),
})

const functionHookOutput = z.object({
  hookId: z.string().describe('Hook ID for later removal'),
  target: z.string().describe('Function that was hooked'),
  type: z.string().describe('Hook type'),
})

export const functionHookToolDef: ToolDefinition = {
  name: 'function_hook',
  groups: ['instrument'],
  description: 'Hook a function with pre/post callbacks',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'function_hook',
      description: `Hook a function in the connected application to intercept calls.

Hook types:
- wrap: Full interception with before/after callbacks
- before: Only intercept before the call
- after: Only intercept after the call

Use this to:
- Log function calls and arguments
- Modify arguments before they reach the function
- Modify return values
- Track API calls and state changes

Example targets:
- "window.fetch" - Hook all fetch calls
- "window.store.dispatch" - Hook Redux dispatch
- "window.myApp.api.sendMessage" - Hook specific app function`,
      input: functionHookInput,
      output: functionHookOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof functionHookInput>,
          z.infer<typeof functionHookOutput>
        >('/instrument/hook', input, ctx.config)
      },
    }),
}

// ============ Function Replace ============

const functionReplaceInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  target: z.string().describe('Path to function to replace'),
  replacement: z.string().describe('JavaScript code for replacement function'),
  hookId: z.string().optional().describe('Custom ID for this hook'),
})

const functionReplaceOutput = z.object({
  hookId: z.string().describe('Hook ID for restoration'),
  target: z.string().describe('Function that was replaced'),
  type: z.literal('replace'),
})

export const functionReplaceToolDef: ToolDefinition = {
  name: 'function_replace',
  groups: ['instrument'],
  description: 'Replace a function implementation entirely',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'function_replace',
      description: `Replace a function in the connected application with a custom implementation.

Use this when you need to completely change a function's behavior rather than just intercept it.

The original function is saved and can be restored using hook_remove.

Example:
- target: "window.myApp.validateInput"
- replacement: "function(input) { return true; }" // Bypass validation`,
      input: functionReplaceInput,
      output: functionReplaceOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof functionReplaceInput>,
          z.infer<typeof functionReplaceOutput>
        >('/instrument/replace', input, ctx.config)
      },
    }),
}

// ============ IPC Intercept ============

const ipcInterceptInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  channel: z.string().describe('IPC channel name to intercept ("*" for all)'),
  direction: z
    .enum(['send', 'receive', 'both'])
    .default('both')
    .describe('Direction to intercept'),
  hookId: z.string().optional(),
})

const ipcInterceptOutput = z.object({
  hookId: z.string(),
  channel: z.string(),
  direction: z.string(),
  type: z.literal('ipc-intercept'),
})

export const ipcInterceptToolDef: ToolDefinition = {
  name: 'ipc_intercept',
  groups: ['instrument'],
  description: 'Intercept Electron IPC messages',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'ipc_intercept',
      description: `Intercept Electron IPC messages on a specific channel.

Use this to:
- Monitor communication between renderer and main process
- Log IPC messages for analysis
- Understand how features are implemented

Set channel to "*" to intercept all channels (verbose).`,
      input: ipcInterceptInput,
      output: ipcInterceptOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof ipcInterceptInput>,
          z.infer<typeof ipcInterceptOutput>
        >('/instrument/ipc-intercept', input, ctx.config)
      },
    }),
}

// ============ State Subscribe ============

const stateSubscribeInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  storePath: z.string().describe('Path to store (e.g., "window.store")'),
  selector: z
    .string()
    .optional()
    .describe('State path to watch (e.g., "user.name")'),
  hookId: z.string().optional(),
})

const stateSubscribeOutput = z.object({
  hookId: z.string(),
  storePath: z.string(),
  selector: z.string().nullable(),
  type: z.literal('state-subscribe'),
  initialState: z.unknown().describe('Initial state value'),
})

export const stateSubscribeToolDef: ToolDefinition = {
  name: 'state_subscribe',
  groups: ['instrument'],
  description: 'Watch state store changes',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'state_subscribe',
      description: `Subscribe to state changes in a Redux/Zustand/custom store.

Use this to:
- Monitor when specific state changes
- Track user actions that affect state
- Understand the data flow in an application

Requires a store with a subscribe() method.`,
      input: stateSubscribeInput,
      output: stateSubscribeOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof stateSubscribeInput>,
          z.infer<typeof stateSubscribeOutput>
        >('/instrument/state-subscribe', input, ctx.config)
      },
    }),
}

// ============ Inject Script ============

const injectScriptInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  script: z.string().describe('JavaScript code to inject and execute'),
  persistent: z
    .boolean()
    .optional()
    .default(false)
    .describe('Re-inject on navigation (not yet implemented)'),
})

const injectScriptOutput = z.object({
  result: z.unknown().describe('Script execution result'),
  type: z.string().describe('Result type'),
})

export const injectScriptToolDef: ToolDefinition = {
  name: 'inject_script',
  groups: ['instrument'],
  description: 'Inject and execute arbitrary JavaScript',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'inject_script',
      description: `Inject and execute JavaScript code in the connected application.

Use this for custom automation logic that doesn't fit other tools:
- Define helper functions
- Set up complex monitoring
- Trigger application actions
- Manipulate application state directly

The script runs in the page context with full access to window, document, etc.`,
      input: injectScriptInput,
      output: injectScriptOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof injectScriptInput>,
          z.infer<typeof injectScriptOutput>
        >('/instrument/inject', input, ctx.config)
      },
    }),
}

// ============ Remove Hook ============

const removeHookInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  hookId: z.string().describe('Hook ID to remove'),
})

const removeHookOutput = z.object({
  removed: z.boolean().describe('Whether hook was removed'),
  hookId: z.string().optional(),
  reason: z.string().optional(),
})

export const removeHookToolDef: ToolDefinition = {
  name: 'hook_remove',
  groups: ['instrument'],
  description: 'Remove a previously installed hook',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'hook_remove',
      description: `Remove a previously installed hook and restore original behavior.

This will:
- Restore the original function if it was hooked/replaced
- Unsubscribe from state changes
- Stop IPC interception

Use hook_list to see all active hooks.`,
      input: removeHookInput,
      output: removeHookOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof removeHookInput>,
          z.infer<typeof removeHookOutput>
        >('/instrument/remove-hook', input, ctx.config)
      },
    }),
}

// ============ List Hooks ============

const listHooksInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
})

const listHooksOutput = z.object({
  runtime: z
    .array(
      z.object({
        hookId: z.string(),
        target: z.string().optional(),
        type: z.string().optional(),
        hasOriginal: z.boolean().optional(),
      })
    )
    .describe('Hooks registered in the page runtime'),
  registry: z
    .array(
      z.object({
        hookId: z.string(),
        type: z.string(),
        target: z.string(),
        installed: z.number(),
      })
    )
    .describe('Hooks registered in the server'),
})

export const listHooksToolDef: ToolDefinition = {
  name: 'hook_list',
  groups: ['instrument'],
  description: 'List all installed hooks for a session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'hook_list',
      description: `List all hooks currently installed for a CDP session.

Returns hooks from both the page runtime and the server registry.
Use hook IDs from this list with hook_remove to clean up hooks.`,
      input: listHooksInput,
      output: listHooksOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof listHooksInput>,
          z.infer<typeof listHooksOutput>
        >('/instrument/list-hooks', input, ctx.config)
      },
    }),
}
