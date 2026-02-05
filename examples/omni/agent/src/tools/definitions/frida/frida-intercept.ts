/**
 * Frida Interception Tools - Hook and replace functions
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ Frida Intercept ============

const fridaInterceptInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  module: z
    .string()
    .describe(
      'Module containing the function (e.g., "libc.so.6", "libSystem.B.dylib")'
    ),
  function: z.string().describe('Function name to intercept'),
  onEnter: z
    .string()
    .optional()
    .describe(
      'JavaScript code for onEnter callback. Has access to "args" array.'
    ),
  onLeave: z
    .string()
    .optional()
    .describe(
      'JavaScript code for onLeave callback. Has access to "retval".'
    ),
})

const fridaInterceptOutput = z.object({
  hookId: z.string().describe('Hook ID for later removal'),
  scriptId: z.string().describe('Script ID'),
})

export const fridaInterceptToolDef: ToolDefinition = {
  name: 'frida_intercept',
  groups: ['frida'],
  description: 'Hook a function with onEnter/onLeave callbacks',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_intercept',
      description: `Intercept calls to a native function with onEnter and onLeave callbacks.

The callbacks are Frida JavaScript code that runs in the target process:
- onEnter: Runs when the function is called. "args" is an array of NativePointer arguments.
- onLeave: Runs when the function returns. "retval" is the return value.

Common patterns:
- Log arguments: "console.log('called with', args[0].toInt32())"
- Log return: "console.log('returned', retval.toInt32())"
- Modify args: "args[0] = ptr('0x1234')"
- Modify return: "retval.replace(ptr('0x0'))"

Examples:
- Hook open() to log file paths:
  {"module": "libc.so.6", "function": "open",
   "onEnter": "console.log('open:', args[0].readUtf8String())"}

- Hook SSL_write to log data:
  {"module": "libssl.so", "function": "SSL_write",
   "onEnter": "console.log('SSL write:', args[2].toInt32(), 'bytes')"}`,
      input: fridaInterceptInput,
      output: fridaInterceptOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaInterceptInput>,
          z.infer<typeof fridaInterceptOutput>
        >('/frida/intercept', input, ctx.config)
      },
    }),
}

// ============ Frida Replace ============

const fridaReplaceInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  module: z.string().describe('Module containing the function'),
  function: z.string().describe('Function name to replace'),
  implementation: z
    .string()
    .describe('JavaScript code for the replacement function'),
  returnType: z
    .string()
    .optional()
    .default('void')
    .describe('Return type (e.g., "void", "int", "pointer")'),
  argTypes: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Argument types (e.g., ["int", "pointer"])'),
})

const fridaReplaceOutput = z.object({
  hookId: z.string().describe('Hook ID for later removal'),
  scriptId: z.string().describe('Script ID'),
})

export const fridaReplaceToolDef: ToolDefinition = {
  name: 'frida_replace',
  groups: ['frida'],
  description: 'Replace a function entirely with custom implementation',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_replace',
      description: `Replace a native function entirely with a custom implementation.

Use with caution - the original function is completely replaced.
The implementation must return the expected type.

Parameters:
- returnType: The return type of the function (default: "void")
- argTypes: Array of argument types (default: [])

Examples:
- Always return success (int function):
  {"module": "libc.so.6", "function": "access",
   "implementation": "return 0;", "returnType": "int", "argTypes": ["pointer", "int"]}

- Bypass authentication:
  {"module": "mylib.so", "function": "check_password",
   "implementation": "return 1;", "returnType": "int", "argTypes": ["pointer"]}`,
      input: fridaReplaceInput,
      output: fridaReplaceOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaReplaceInput>,
          z.infer<typeof fridaReplaceOutput>
        >('/frida/replace', input, ctx.config)
      },
    }),
}

// ============ Frida Call ============

const fridaCallInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  module: z.string().describe('Module containing the function'),
  function: z.string().describe('Function name to call'),
  returnType: z
    .string()
    .describe('Return type (e.g., "int", "void", "pointer")'),
  argTypes: z
    .array(z.string())
    .describe('Argument types (e.g., ["int", "pointer"])'),
  args: z.array(z.unknown()).describe('Arguments to pass to the function'),
})

const fridaCallOutput = z.object({
  result: z.unknown().describe('Return value from the function'),
})

export const fridaCallToolDef: ToolDefinition = {
  name: 'frida_call',
  groups: ['frida'],
  description: 'Call a native function directly',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_call',
      description: `Call a native function directly with specified arguments.

Type mapping:
- "void" - No return value
- "int", "uint", "long", "ulong" - Integer types
- "float", "double" - Floating point
- "pointer" - Memory address (use hex string like "0x12345")
- "bool" - Boolean

Examples:
- Call getpid():
  {"module": "libc.so.6", "function": "getpid",
   "returnType": "int", "argTypes": [], "args": []}

- Call strlen():
  {"module": "libc.so.6", "function": "strlen",
   "returnType": "uint", "argTypes": ["pointer"],
   "args": ["0x7fff12345678"]}`,
      input: fridaCallInput,
      output: fridaCallOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaCallInput>,
          z.infer<typeof fridaCallOutput>
        >('/frida/call', input, ctx.config)
      },
    }),
}

// ============ Frida Remove Hook ============

const fridaRemoveHookInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  hookId: z.string().describe('Hook ID to remove'),
})

const fridaRemoveHookOutput = z.object({
  removed: z.boolean().describe('Whether hook was removed'),
})

export const fridaRemoveHookToolDef: ToolDefinition = {
  name: 'frida_remove_hook',
  groups: ['frida'],
  description: 'Remove a function hook',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_remove_hook',
      description: `Remove a previously installed function hook.

The original function behavior is restored after removal.`,
      input: fridaRemoveHookInput,
      output: fridaRemoveHookOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaRemoveHookInput>,
          z.infer<typeof fridaRemoveHookOutput>
        >('/frida/hook/remove', input, ctx.config)
      },
    }),
}

// ============ Frida List Hooks ============

const fridaListHooksInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
})

const hookSchema = z.object({
  id: z.string().describe('Hook ID'),
  module: z.string().describe('Module name'),
  function: z.string().describe('Function name'),
  type: z.enum(['intercept', 'replace']).describe('Hook type'),
  scriptId: z.string().describe('Associated script ID'),
})

const fridaListHooksOutput = z.object({
  hooks: z.array(hookSchema).describe('Active hooks'),
  count: z.number().describe('Number of hooks'),
})

export const fridaListHooksToolDef: ToolDefinition = {
  name: 'frida_list_hooks',
  groups: ['frida'],
  description: 'List active function hooks',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_list_hooks',
      description: `List all active function hooks in a Frida session.

Use this to see what functions are currently being intercepted or replaced.`,
      input: fridaListHooksInput,
      output: fridaListHooksOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaListHooksInput>,
          z.infer<typeof fridaListHooksOutput>
        >('/frida/hooks', input, ctx.config)
      },
    }),
}
