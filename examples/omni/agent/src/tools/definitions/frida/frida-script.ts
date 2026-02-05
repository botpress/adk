/**
 * Frida Script Tools - Load scripts and evaluate code
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ Frida Load Script ============

const fridaScriptInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  source: z.string().describe('Frida JavaScript script source code'),
  name: z.string().optional().describe('Optional name for the script'),
})

const fridaScriptOutput = z.object({
  id: z.string().describe('Script ID'),
  sessionId: z.string().describe('Session ID'),
})

export const fridaScriptToolDef: ToolDefinition = {
  name: 'frida_script',
  groups: ['frida'],
  description: 'Load and run a custom Frida script',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_script',
      description: `Load and execute a custom Frida script in the target process.

The script has access to the full Frida JavaScript API:
- Interceptor: Hook functions
- Process: Process info and memory operations
- Module: Module enumeration
- Memory: Read/write memory
- ObjC: Objective-C runtime (macOS/iOS)
- Java: Java runtime (Android)

Example script to log all file opens:
\`\`\`
Interceptor.attach(Module.findExportByName('libc.so.6', 'open'), {
  onEnter: function(args) {
    console.log('Opening:', args[0].readUtf8String());
  }
});
\`\`\`

For RPC exports accessible from the host:
\`\`\`
rpc.exports = {
  getInfo: function() { return Process.id; }
};
\`\`\``,
      input: fridaScriptInput,
      output: fridaScriptOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaScriptInput>,
          z.infer<typeof fridaScriptOutput>
        >('/frida/script', input, ctx.config)
      },
    }),
}

// ============ Frida Unload Script ============

const fridaUnloadScriptInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  scriptId: z.string().describe('Script ID to unload'),
})

const fridaUnloadScriptOutput = z.object({
  unloaded: z.boolean().describe('Whether script was unloaded'),
})

export const fridaUnloadScriptToolDef: ToolDefinition = {
  name: 'frida_unload_script',
  groups: ['frida'],
  description: 'Unload a Frida script',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_unload_script',
      description: `Unload a previously loaded Frida script.

All hooks and modifications made by the script are removed.`,
      input: fridaUnloadScriptInput,
      output: fridaUnloadScriptOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaUnloadScriptInput>,
          z.infer<typeof fridaUnloadScriptOutput>
        >('/frida/script/unload', input, ctx.config)
      },
    }),
}

// ============ Frida Evaluate ============

const fridaEvaluateInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  expression: z
    .string()
    .describe('JavaScript expression to evaluate in target process'),
})

const fridaEvaluateOutput = z.object({
  result: z.unknown().describe('Evaluation result'),
})

export const fridaEvaluateToolDef: ToolDefinition = {
  name: 'frida_evaluate',
  groups: ['frida'],
  description: 'Evaluate JavaScript in the target process',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_evaluate',
      description: `Evaluate a JavaScript expression in the target process using Frida.

The expression has access to the Frida JavaScript API.

Examples:
- "Process.id" - Get the process ID
- "Module.enumerateModules()[0]" - Get first module
- "Process.enumerateRanges('r--')" - Get readable memory ranges`,
      input: fridaEvaluateInput,
      output: fridaEvaluateOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaEvaluateInput>,
          z.infer<typeof fridaEvaluateOutput>
        >('/frida/evaluate', input, ctx.config)
      },
    }),
}

// ============ Frida Memory Read ============

const fridaMemoryReadInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  address: z
    .string()
    .describe('Memory address as hex string (e.g., "0x7fff12345678")'),
  size: z.number().describe('Number of bytes to read'),
})

const fridaMemoryReadOutput = z.object({
  address: z.string().describe('Address that was read'),
  size: z.number().describe('Number of bytes read'),
  hex: z.string().describe('Hex-encoded bytes'),
})

export const fridaMemoryReadToolDef: ToolDefinition = {
  name: 'frida_memory_read',
  groups: ['frida'],
  description: 'Read memory from the target process',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_memory_read',
      description: `Read raw memory from the target process.

Returns hex-encoded bytes at the specified address.

Use with addresses obtained from:
- Module base addresses (from frida_modules)
- Function addresses (from frida_exports)
- Pointers captured in hook callbacks`,
      input: fridaMemoryReadInput,
      output: fridaMemoryReadOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaMemoryReadInput>,
          z.infer<typeof fridaMemoryReadOutput>
        >('/frida/memory/read', input, ctx.config)
      },
    }),
}

// ============ Frida Memory Write ============

const fridaMemoryWriteInput = z.object({
  sessionId: z.string().describe('Frida session ID'),
  address: z.string().describe('Memory address as hex string'),
  data: z.string().describe('Hex-encoded data to write'),
})

const fridaMemoryWriteOutput = z.object({
  written: z.boolean().describe('Whether write was successful'),
})

export const fridaMemoryWriteToolDef: ToolDefinition = {
  name: 'frida_memory_write',
  groups: ['frida'],
  description: 'Write memory in the target process',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_memory_write',
      description: `Write raw bytes to memory in the target process.

Use with caution - writing to the wrong address can crash the process.

The data should be hex-encoded (e.g., "90909090" for NOP instructions).`,
      input: fridaMemoryWriteInput,
      output: fridaMemoryWriteOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaMemoryWriteInput>,
          z.infer<typeof fridaMemoryWriteOutput>
        >('/frida/memory/write', input, ctx.config)
      },
    }),
}
