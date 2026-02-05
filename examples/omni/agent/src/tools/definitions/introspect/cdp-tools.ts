/**
 * CDP Tools - Chrome DevTools Protocol interaction tools
 */

import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition } from '../../types.js'
import { callLocalPlane } from '../../../bridge/client.js'

// ============ CDP Connect ============

const cdpConnectInput = z.object({
  cdpPort: z
    .number()
    .optional()
    .describe('CDP debug port to connect to (e.g., 9222)'),
  wsEndpoint: z
    .string()
    .optional()
    .describe('WebSocket endpoint URL (alternative to port)'),
  targetId: z
    .string()
    .optional()
    .describe('Specific target/page ID to attach to'),
})

const cdpConnectOutput = z.object({
  sessionId: z.string().describe('Session ID for subsequent CDP operations'),
  wsEndpoint: z.string().describe('WebSocket endpoint connected to'),
  targetId: z.string().optional().describe('Target ID if attached to specific page'),
})

export const cdpConnectToolDef: ToolDefinition = {
  name: 'cdp_connect',
  groups: ['introspect'],
  description: 'Connect to a Chrome DevTools Protocol endpoint',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'cdp_connect',
      description: `Connect to a Chrome DevTools Protocol (CDP) endpoint on an Electron or Chromium app.

Use this after app_discover finds an app with a CDP port, or after launching an app with CDP enabled.

The session ID returned is used for all subsequent CDP operations (evaluate, dom, etc.).`,
      input: cdpConnectInput,
      output: cdpConnectOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof cdpConnectInput>,
          z.infer<typeof cdpConnectOutput>
        >('/introspect/cdp/connect', input, ctx.config)
      },
    }),
}

// ============ CDP Evaluate ============

const cdpEvaluateInput = z.object({
  sessionId: z.string().describe('CDP session ID from cdp_connect'),
  expression: z.string().describe('JavaScript expression to evaluate in page context'),
  returnByValue: z
    .boolean()
    .optional()
    .default(true)
    .describe('Return result by value (true) or as object reference (false)'),
  awaitPromise: z
    .boolean()
    .optional()
    .default(true)
    .describe('Wait for promise to resolve if expression returns a promise'),
})

const cdpEvaluateOutput = z.object({
  result: z.unknown().describe('Result of the evaluation'),
  type: z.string().describe('Type of the result'),
})

export const cdpEvaluateToolDef: ToolDefinition = {
  name: 'cdp_evaluate',
  groups: ['introspect'],
  description: 'Execute JavaScript in the connected app context',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'cdp_evaluate',
      description: `Execute JavaScript code in the context of a connected Electron/Chromium app.

Use this to:
- Inspect application state
- Call application functions
- Query DOM elements
- Access webpack modules, Redux stores, React components

Examples:
- "document.title" - Get page title
- "window.__REDUX_STORE__.getState()" - Get Redux state
- "Object.keys(window.__webpack_modules__).slice(0, 10)" - List webpack modules`,
      input: cdpEvaluateInput,
      output: cdpEvaluateOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof cdpEvaluateInput>,
          z.infer<typeof cdpEvaluateOutput>
        >('/introspect/cdp/evaluate', input, ctx.config)
      },
    }),
}

// ============ CDP DOM ============

const cdpDomInput = z.object({
  sessionId: z.string().describe('CDP session ID'),
  selector: z.string().optional().describe('CSS selector to query (omit for full document)'),
  multiple: z.boolean().optional().default(false).describe('Return all matching elements'),
})

const cdpDomOutput = z.object({
  document: z.unknown().optional().describe('Document structure if no selector'),
  nodeId: z.number().optional().describe('Node ID of matched element'),
  nodeIds: z.array(z.number()).optional().describe('Node IDs if multiple=true'),
  found: z.boolean().optional().describe('Whether element was found'),
  count: z.number().optional().describe('Number of elements found'),
})

export const cdpDomToolDef: ToolDefinition = {
  name: 'cdp_dom',
  groups: ['introspect'],
  description: 'Query DOM elements in the connected app',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'cdp_dom',
      description: `Query DOM elements in a connected Electron/Chromium app via CDP.

Use this to find specific elements by CSS selector or get the full document structure.`,
      input: cdpDomInput,
      output: cdpDomOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof cdpDomInput>,
          z.infer<typeof cdpDomOutput>
        >('/introspect/cdp/dom', input, ctx.config)
      },
    }),
}

// ============ CDP Targets ============

const cdpTargetsInput = z.object({
  cdpPort: z.number().describe('CDP port to query for targets'),
})

const targetSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  url: z.string(),
  webSocketDebuggerUrl: z.string().optional(),
})

const cdpTargetsOutput = z.object({
  targets: z.array(targetSchema).describe('List of CDP targets (pages, workers, etc.)'),
  count: z.number().describe('Number of targets'),
})

export const cdpTargetsToolDef: ToolDefinition = {
  name: 'cdp_targets',
  groups: ['introspect'],
  description: 'List available CDP targets (pages, workers) on a port',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'cdp_targets',
      description: `List all available CDP targets on a debug port.

Targets include pages, service workers, and other debuggable contexts.
Use this to find specific pages to connect to with cdp_connect.`,
      input: cdpTargetsInput,
      output: cdpTargetsOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof cdpTargetsInput>,
          z.infer<typeof cdpTargetsOutput>
        >('/introspect/cdp/targets', input, ctx.config)
      },
    }),
}

// ============ CDP Close ============

const cdpCloseInput = z.object({
  sessionId: z.string().describe('CDP session ID to close'),
})

const cdpCloseOutput = z.object({
  closed: z.boolean().describe('Whether session was closed'),
})

export const cdpCloseToolDef: ToolDefinition = {
  name: 'cdp_close',
  groups: ['introspect'],
  description: 'Close a CDP session',
  factory: (ctx) =>
    new Autonomous.Tool({
      name: 'cdp_close',
      description: 'Close an active CDP session and release resources.',
      input: cdpCloseInput,
      output: cdpCloseOutput,
      handler: async (input) => {
        return await callLocalPlane<
          z.infer<typeof cdpCloseInput>,
          z.infer<typeof cdpCloseOutput>
        >('/introspect/cdp/close', input, ctx.config)
      },
    }),
}
