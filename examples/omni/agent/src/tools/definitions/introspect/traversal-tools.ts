/**
 * Traversal Tools - Deep inspection of app internals
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ Module Traverse ============

const moduleTraverseInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  pattern: z
    .string()
    .optional()
    .describe('Module path pattern to match (e.g., "api", "service")'),
  maxModules: z.number().optional().default(100).describe('Maximum modules to return'),
})

const moduleTraverseOutput = z.object({
  found: z.boolean().describe('Whether webpack modules were found'),
  modules: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        hasExports: z.boolean(),
      })
    )
    .describe('List of matching modules'),
})

export const moduleTraverseToolDef: ToolDefinition = {
  name: 'module_traverse',
  groups: ['introspect'],
  description: 'Walk webpack modules in an Electron/React app',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'module_traverse',
      description: `Traverse webpack modules in a connected Electron or React application.

Use this to:
- Find specific modules by path pattern
- Discover API endpoints, services, and utilities
- Map the internal module structure of an app

Common patterns:
- "api" - Find API-related modules
- "service" - Find service modules
- "store" - Find state management modules
- "component" - Find React components`,
      input: moduleTraverseInput,
      output: moduleTraverseOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof moduleTraverseInput>,
          z.infer<typeof moduleTraverseOutput>
        >('/introspect/modules', input, ctx.config)
      },
    }),
}

// ============ Store Discover ============

const storeDiscoverInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  storeTypes: z
    .array(z.enum(['redux', 'mobx', 'zustand', 'vuex', 'any']))
    .optional()
    .default(['any'])
    .describe('Types of stores to look for'),
})

const storeDiscoverOutput = z.object({
  stores: z
    .array(
      z.object({
        type: z.string(),
        found: z.boolean(),
        location: z.string().optional(),
        hasSubscribe: z.boolean().optional(),
        hasGetState: z.boolean().optional(),
        hasDispatch: z.boolean().optional(),
      })
    )
    .describe('Discovered state stores'),
  count: z.number().describe('Number of stores found'),
})

export const storeDiscoverToolDef: ToolDefinition = {
  name: 'store_discover',
  groups: ['introspect'],
  description: 'Find Redux/MobX/Zustand stores in an app',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'store_discover',
      description: `Discover state management stores in a connected application.

Searches for:
- Redux stores (__REDUX_DEVTOOLS_EXTENSION__, store.getState())
- Zustand stores (__ZUSTAND_DEVTOOLS_HOOK__)
- MobX stores (__MOBX_DEVTOOLS_GLOBAL_HOOK__)
- Custom stores with subscribe/getState/dispatch methods

Use this to find where application state is stored for later instrumentation.`,
      input: storeDiscoverInput,
      output: storeDiscoverOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof storeDiscoverInput>,
          z.infer<typeof storeDiscoverOutput>
        >('/introspect/stores', input, ctx.config)
      },
    }),
}

// ============ React Inspect ============

const reactInspectInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  componentName: z
    .string()
    .optional()
    .describe('Component name to find (partial match)'),
  maxDepth: z.number().optional().default(10).describe('Maximum fiber tree depth to traverse'),
})

const reactInspectOutput = z.object({
  found: z.boolean().describe('Whether React was detected'),
  reactVersion: z.string().nullable().describe('React version if available'),
  components: z
    .array(
      z.object({
        name: z.string(),
        depth: z.number(),
        hasState: z.boolean(),
        hasProps: z.boolean(),
        key: z.string().nullable().optional(),
      })
    )
    .describe('Matching React components'),
})

export const reactInspectToolDef: ToolDefinition = {
  name: 'react_inspect',
  groups: ['introspect'],
  description: 'Inspect React component tree in an app',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'react_inspect',
      description: `Inspect the React component tree in a connected application.

Use this to:
- Find specific React components by name
- Understand the component hierarchy
- Identify components with state for potential instrumentation

Requires React DevTools hook to be present (most React apps have this).`,
      input: reactInspectInput,
      output: reactInspectOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof reactInspectInput>,
          z.infer<typeof reactInspectOutput>
        >('/introspect/react', input, ctx.config)
      },
    }),
}

// ============ IPC Enumerate ============

const ipcEnumerateInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
})

const ipcEnumerateOutput = z.object({
  isElectron: z.boolean().describe('Whether this is an Electron app'),
  ipcRenderer: z
    .object({
      available: z.boolean(),
      error: z.string().optional(),
    })
    .nullable()
    .describe('IPC renderer access info'),
  exposedApis: z
    .array(
      z.object({
        name: z.string(),
        methods: z.array(z.string()),
      })
    )
    .describe('APIs exposed via contextBridge'),
})

export const ipcEnumerateToolDef: ToolDefinition = {
  name: 'ipc_enumerate',
  groups: ['introspect'],
  description: 'List Electron IPC channels and exposed APIs',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'ipc_enumerate',
      description: `Enumerate Electron IPC channels and APIs exposed via contextBridge.

Use this to:
- Discover how the app communicates between renderer and main process
- Find exposed API methods that can be called
- Understand the app's IPC architecture

Returns info about:
- Whether ipcRenderer is directly accessible
- APIs exposed via window.electronAPI, window.api, etc.`,
      input: ipcEnumerateInput,
      output: ipcEnumerateOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof ipcEnumerateInput>,
          z.infer<typeof ipcEnumerateOutput>
        >('/introspect/ipc', input, ctx.config)
      },
    }),
}
