/**
 * Frida Attach Tools - Attach to and spawn processes with Frida
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ Frida Process List ============

const fridaProcessListInput = z.object({
  filter: z
    .string()
    .optional()
    .describe('Filter processes by name (partial match)'),
})

const processSchema = z.object({
  pid: z.number().describe('Process ID'),
  name: z.string().describe('Process name'),
})

const fridaProcessListOutput = z.object({
  processes: z.array(processSchema).describe('List of running processes'),
  count: z.number().describe('Number of processes'),
})

export const fridaProcessListToolDef: ToolDefinition = {
  name: 'frida_process_list',
  groups: ['frida'],
  description: 'List running processes available for Frida attachment',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_process_list',
      description: `List running processes on the local machine that can be attached to with Frida.

Use this to find target process PIDs before using frida_attach.

Examples:
- {} - List all processes
- {"filter": "slack"} - Find Slack processes`,
      input: fridaProcessListInput,
      output: fridaProcessListOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaProcessListInput>,
          z.infer<typeof fridaProcessListOutput>
        >('/frida/processes', input, ctx.config)
      },
    }),
}

// ============ Frida Attach ============

const fridaAttachInput = z.object({
  target: z
    .union([
      z.number().describe('Process ID to attach to'),
      z.string().describe('Process name to attach to'),
    ])
    .describe('Process to attach to (PID or name)'),
})

const sessionInfoSchema = z.object({
  id: z.string().describe('Frida session ID for subsequent operations'),
  pid: z.number().describe('Process ID'),
  processName: z.string().describe('Process name'),
  activeScripts: z.number().describe('Number of loaded scripts'),
  activeHooks: z.number().describe('Number of active hooks'),
})

const fridaAttachOutput = sessionInfoSchema

export const fridaAttachToolDef: ToolDefinition = {
  name: 'frida_attach',
  groups: ['frida'],
  description: 'Attach Frida to a running process',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_attach',
      description: `Attach Frida to a running native process for dynamic instrumentation.

Use this to:
- Connect to a process before hooking functions
- Inspect loaded modules
- Enumerate exported functions

After attaching, use the session ID for subsequent Frida operations (frida_modules, frida_intercept, etc.).

Examples:
- {"target": 12345} - Attach to process with PID 12345
- {"target": "slack"} - Attach to process named "slack"`,
      input: fridaAttachInput,
      output: fridaAttachOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaAttachInput>,
          z.infer<typeof fridaAttachOutput>
        >('/frida/attach', input, ctx.config)
      },
    }),
}

// ============ Frida Spawn ============

const fridaSpawnInput = z.object({
  program: z.string().describe('Path to the program to spawn'),
  args: z
    .array(z.string())
    .optional()
    .default([])
    .describe('Command line arguments'),
  cwd: z.string().optional().describe('Working directory'),
  env: z
    .record(z.string())
    .optional()
    .describe('Environment variables'),
})

const fridaSpawnOutput = sessionInfoSchema

export const fridaSpawnToolDef: ToolDefinition = {
  name: 'frida_spawn',
  groups: ['frida'],
  description: 'Spawn a new process with Frida attached from start',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_spawn',
      description: `Spawn a new process with Frida attached from the beginning.

Use this when you need to:
- Hook functions that run during process startup
- Instrument a program from the very first instruction
- Start a program with specific arguments or environment

The process starts suspended and is automatically resumed after Frida attaches.

Examples:
- {"program": "/usr/bin/ls", "args": ["-la"]}
- {"program": "/path/to/app", "env": {"DEBUG": "1"}}`,
      input: fridaSpawnInput,
      output: fridaSpawnOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaSpawnInput>,
          z.infer<typeof fridaSpawnOutput>
        >('/frida/spawn', input, ctx.config)
      },
    }),
}

// ============ Frida Detach ============

const fridaDetachInput = z.object({
  sessionId: z.string().describe('Frida session ID to detach from'),
})

const fridaDetachOutput = z.object({
  detached: z.boolean().describe('Whether detachment was successful'),
})

export const fridaDetachToolDef: ToolDefinition = {
  name: 'frida_detach',
  groups: ['frida'],
  description: 'Detach Frida from a process',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_detach',
      description: `Detach Frida from a process and clean up resources.

All loaded scripts and hooks are automatically removed when detaching.
The target process continues running normally after detachment.`,
      input: fridaDetachInput,
      output: fridaDetachOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaDetachInput>,
          z.infer<typeof fridaDetachOutput>
        >('/frida/detach', input, ctx.config)
      },
    }),
}

// ============ Frida List Sessions ============

const fridaListSessionsInput = z.object({})

const fridaListSessionsOutput = z.object({
  sessions: z.array(sessionInfoSchema).describe('Active Frida sessions'),
  count: z.number().describe('Number of sessions'),
})

export const fridaListSessionsToolDef: ToolDefinition = {
  name: 'frida_sessions',
  groups: ['frida'],
  description: 'List active Frida sessions',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'frida_sessions',
      description: `List all active Frida sessions.

Use this to see what processes are currently instrumented and get session IDs.`,
      input: fridaListSessionsInput,
      output: fridaListSessionsOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof fridaListSessionsInput>,
          z.infer<typeof fridaListSessionsOutput>
        >('/frida/sessions', input, ctx.config)
      },
    }),
}
