/**
 * Frida Enumeration Tools - Enumerate modules, exports, and classes
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ Frida Enumerate Modules ============

const fridaModulesInput = z.object({
  sessionId: z.string().describe('Frida session ID from frida_attach'),
})

const moduleSchema = z.object({
  name: z.string().describe('Module name (e.g., libc.so.6)'),
  base: z.string().describe('Base address in memory'),
  size: z.number().describe('Size in bytes'),
  path: z.string().describe('Path to the module file'),
})

const fridaModulesOutput = z.object({
  modules: z.array(moduleSchema).describe('Loaded modules'),
  count: z.number().describe('Number of modules'),
})

export const fridaModulesToolDef: ToolDefinition = {
  name: 'frida_modules',
  groups: ['frida'],
  description: 'List loaded modules in the target process',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_modules',
      description: `Enumerate all loaded modules (shared libraries) in the target process.

Use this to:
- Find interesting libraries to hook
- Get module base addresses
- Understand what code is loaded

Common modules to look for:
- Linux: libc.so.6, libpthread.so, libssl.so
- macOS: libSystem.B.dylib, CoreFoundation, Security
- App-specific: Custom libraries, language runtimes`,
      input: fridaModulesInput,
      output: fridaModulesOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaModulesInput>,
          z.infer<typeof fridaModulesOutput>
        >('/frida/modules', input, ctx.config)
      },
    }),
}

// ============ Frida Enumerate Exports ============

const fridaExportsInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  module: z.string().describe('Module name to enumerate exports from'),
})

const exportSchema = z.object({
  type: z.enum(['function', 'variable']).describe('Export type'),
  name: z.string().describe('Export name (function or variable)'),
  address: z.string().describe('Memory address'),
})

const fridaExportsOutput = z.object({
  exports: z.array(exportSchema).describe('Exported symbols'),
  count: z.number().describe('Number of exports'),
  module: z.string().describe('Module name'),
})

export const fridaExportsToolDef: ToolDefinition = {
  name: 'frida_exports',
  groups: ['frida'],
  description: 'List exports from a specific module',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_exports',
      description: `Enumerate exports (functions and variables) from a specific module.

Use this to:
- Find functions to hook
- Discover the API surface of a library
- Get function addresses for direct calls

Examples:
- {"sessionId": "...", "module": "libc.so.6"} - List libc functions
- {"sessionId": "...", "module": "libssl.so"} - List SSL/TLS functions`,
      input: fridaExportsInput,
      output: fridaExportsOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaExportsInput>,
          z.infer<typeof fridaExportsOutput>
        >('/frida/exports', input, ctx.config)
      },
    }),
}

// ============ Frida Enumerate Classes ============

const fridaClassesInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
})

const fridaClassesOutput = z.object({
  classes: z.array(z.string()).describe('Class names'),
  count: z.number().describe('Number of classes'),
})

export const fridaClassesToolDef: ToolDefinition = {
  name: 'frida_classes',
  groups: ['frida'],
  description: 'Enumerate Objective-C or Java classes',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_classes',
      description: `Enumerate Objective-C classes (macOS/iOS) or Java classes (Android).

On macOS/iOS: Lists all Objective-C classes loaded in the process.
On Android: Lists all Java classes loaded via the Dalvik/ART runtime.
On other platforms: Returns an empty list.

Use this to:
- Discover available class names for method hooking
- Understand the app's class structure
- Find interesting classes to target`,
      input: fridaClassesInput,
      output: fridaClassesOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaClassesInput>,
          z.infer<typeof fridaClassesOutput>
        >('/frida/classes', input, ctx.config)
      },
    }),
}
