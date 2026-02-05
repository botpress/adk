/**
 * Introspection handlers - HTTP endpoints for app discovery and CDP interaction
 *
 * These handlers enable the omni agent to introspect, instrument,
 * and automate desktop applications (especially Electron apps).
 */

import { z } from 'zod'
import type { Context } from 'hono'
import {
  discoverElectronApps,
  discoverAppByPid,
  findAppByName,
  listProcesses,
  launchAppWithCDP,
  type DiscoveredApp,
} from '../introspect/app-discovery.js'
import {
  connectToCDP,
  sendCDPCommand,
  getCDPSession,
  closeCDPSession,
  listCDPSessions,
  fetchCDPTargets,
  fetchCDPVersion,
  evaluateInContext,
  enableRuntime,
  enableDOM,
  enablePage,
  captureScreenshot,
  getDocument,
  querySelector,
  querySelectorAll,
} from '../introspect/cdp-client.js'

// ============ Input Schemas ============

const appDiscoverSchema = z.object({
  filter: z.enum(['all', 'electron', 'chromium']).optional().default('electron'),
  name: z.string().optional().describe('Filter by app name (partial match)'),
})

const appLaunchSchema = z.object({
  bundleIdOrPath: z.string().describe('App bundle ID (e.g., com.microsoft.VSCode) or path'),
  cdpPort: z.number().optional().default(9222),
})

const cdpConnectSchema = z.object({
  cdpPort: z.number().optional().describe('CDP port to connect to'),
  wsEndpoint: z.string().optional().describe('WebSocket endpoint to connect to'),
  targetId: z.string().optional().describe('Specific target ID to attach to'),
})

const cdpEvaluateSchema = z.object({
  sessionId: z.string(),
  expression: z.string().describe('JavaScript expression to evaluate'),
  returnByValue: z.boolean().optional().default(true),
  awaitPromise: z.boolean().optional().default(true),
})

const cdpCommandSchema = z.object({
  sessionId: z.string(),
  method: z.string().describe('CDP method (e.g., Runtime.evaluate, DOM.querySelector)'),
  params: z.record(z.unknown()).optional(),
})

const cdpTargetsSchema = z.object({
  cdpPort: z.number(),
})

const cdpCloseSchema = z.object({
  sessionId: z.string(),
})

const cdpDomSchema = z.object({
  sessionId: z.string(),
  selector: z.string().optional().describe('CSS selector to query'),
  multiple: z.boolean().optional().default(false),
})

const cdpScreenshotSchema = z.object({
  sessionId: z.string(),
  format: z.enum(['png', 'jpeg', 'webp']).optional().default('png'),
  quality: z.number().optional(),
})

const moduleTraverseSchema = z.object({
  sessionId: z.string(),
  pattern: z.string().optional().describe('Module path pattern to match'),
  maxModules: z.number().optional().default(100),
})

const storeDiscoverSchema = z.object({
  sessionId: z.string(),
  storeTypes: z.array(z.enum(['redux', 'mobx', 'zustand', 'vuex', 'any'])).optional().default(['any']),
})

const reactInspectSchema = z.object({
  sessionId: z.string(),
  componentName: z.string().optional().describe('Component name to find'),
  maxDepth: z.number().optional().default(10),
})

const ipcEnumerateSchema = z.object({
  sessionId: z.string(),
})

const processListSchema = z.object({
  filter: z.string().optional().describe('Filter by process name (partial match)'),
})

const appByPidSchema = z.object({
  pid: z.number().describe('Process ID to inspect'),
})

// ============ Handlers ============

/**
 * Discover running Electron/Chromium apps
 */
export async function handleAppDiscover(c: Context): Promise<Response> {
  try {
    const body = await c.req.json().catch(() => ({}))
    const input = appDiscoverSchema.parse(body)

    let apps: DiscoveredApp[]

    if (input.name) {
      const app = await findAppByName(input.name)
      apps = app ? [app] : []
    } else {
      apps = await discoverElectronApps()

      // Filter by type if specified
      if (input.filter !== 'all') {
        apps = apps.filter((a) => a.type === input.filter)
      }
    }

    return c.json({
      success: true,
      data: {
        apps,
        count: apps.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Launch an app with CDP enabled
 */
export async function handleAppLaunch(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = appLaunchSchema.parse(body)

    const app = await launchAppWithCDP(input.bundleIdOrPath, input.cdpPort)

    if (!app) {
      return c.json({
        success: false,
        error: 'Failed to launch app or detect CDP',
      }, 500)
    }

    return c.json({
      success: true,
      data: { app },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Connect to a CDP endpoint
 */
export async function handleCdpConnect(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpConnectSchema.parse(body)

    let wsEndpoint = input.wsEndpoint

    // If port provided, get the wsEndpoint from version
    if (!wsEndpoint && input.cdpPort) {
      const version = await fetchCDPVersion(input.cdpPort)
      wsEndpoint = version.webSocketDebuggerUrl

      // If targeting a specific page, get its wsEndpoint
      if (input.targetId) {
        const targets = await fetchCDPTargets(input.cdpPort)
        const target = targets.find((t) => t.id === input.targetId)
        if (target?.webSocketDebuggerUrl) {
          wsEndpoint = target.webSocketDebuggerUrl
        }
      }
    }

    if (!wsEndpoint) {
      return c.json({
        success: false,
        error: 'Either wsEndpoint or cdpPort is required',
      }, 400)
    }

    // Normalize ws:// URL
    wsEndpoint = wsEndpoint.replace(/ws:\/\/[^:]+:/, 'ws://127.0.0.1:')

    const session = await connectToCDP(wsEndpoint, input.targetId)

    // Enable commonly needed domains
    await enableRuntime(session)
    await enableDOM(session)
    await enablePage(session)

    return c.json({
      success: true,
      data: {
        sessionId: session.id,
        wsEndpoint: session.wsEndpoint,
        targetId: session.targetId,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * List CDP targets
 */
export async function handleCdpTargets(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpTargetsSchema.parse(body)

    const targets = await fetchCDPTargets(input.cdpPort)

    return c.json({
      success: true,
      data: {
        targets,
        count: targets.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Evaluate JavaScript in the page context
 */
export async function handleCdpEvaluate(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpEvaluateSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await evaluateInContext(session, input.expression, {
      returnByValue: input.returnByValue,
      awaitPromise: input.awaitPromise,
    })

    if (result.exceptionDetails) {
      return c.json({
        success: false,
        error: result.exceptionDetails.exception?.description || result.exceptionDetails.text,
        data: { exception: result.exceptionDetails },
      }, 500)
    }

    return c.json({
      success: true,
      data: {
        result: result.result.value ?? result.result.description,
        type: result.result.type,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Send a raw CDP command
 */
export async function handleCdpCommand(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpCommandSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await sendCDPCommand(session, input.method, input.params)

    return c.json({
      success: true,
      data: { result },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Query DOM elements
 */
export async function handleCdpDom(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpDomSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const doc = await getDocument(session)

    if (!input.selector) {
      // Return document structure
      return c.json({
        success: true,
        data: { document: doc.root },
      })
    }

    if (input.multiple) {
      const result = await querySelectorAll(session, doc.root.nodeId, input.selector)
      return c.json({
        success: true,
        data: { nodeIds: result.nodeIds, count: result.nodeIds.length },
      })
    } else {
      const result = await querySelector(session, doc.root.nodeId, input.selector)
      return c.json({
        success: true,
        data: { nodeId: result.nodeId, found: result.nodeId !== 0 },
      })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Take a screenshot
 */
export async function handleCdpScreenshot(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpScreenshotSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await captureScreenshot(session, {
      format: input.format,
      quality: input.quality,
    })

    return c.json({
      success: true,
      data: {
        base64: result.data,
        format: input.format,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Close a CDP session
 */
export async function handleCdpClose(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = cdpCloseSchema.parse(body)

    const closed = closeCDPSession(input.sessionId)

    if (!closed) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    return c.json({
      success: true,
      data: { closed: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * List active CDP sessions
 */
export async function handleCdpList(c: Context): Promise<Response> {
  const sessions = listCDPSessions()

  return c.json({
    success: true,
    data: { sessions, count: sessions.length },
  })
}

/**
 * Traverse webpack modules in the page
 */
export async function handleModuleTraverse(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = moduleTraverseSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    // JavaScript to find webpack modules
    const script = `
      (function() {
        const result = { found: false, modules: [] };

        // Try different webpack module access patterns
        const webpackRequire = window.__webpack_require__ ||
                               window.webpackJsonp?.[0]?.[1] ||
                               window.__WEBPACK_MODULES__;

        if (!webpackRequire) {
          // Try to find it via chunk loading
          const chunks = Object.keys(window).filter(k =>
            k.startsWith('webpackChunk') || k.startsWith('webpackJsonp')
          );
          if (chunks.length === 0) {
            return result;
          }
        }

        result.found = true;

        // Get module keys
        const modules = window.__webpack_modules__ ||
                       (typeof webpackRequire === 'object' ? webpackRequire : {});

        const pattern = ${JSON.stringify(input.pattern || '')};
        const maxModules = ${input.maxModules};

        let count = 0;
        for (const key of Object.keys(modules)) {
          if (count >= maxModules) break;

          if (!pattern || key.includes(pattern)) {
            const mod = modules[key];
            result.modules.push({
              id: key,
              type: typeof mod,
              hasExports: mod && typeof mod === 'object' && 'exports' in mod,
            });
            count++;
          }
        }

        return result;
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Evaluation failed',
      }, 500)
    }

    return c.json({
      success: true,
      data: evalResult.result.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Discover state stores (Redux, MobX, Zustand)
 */
export async function handleStoreDiscover(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = storeDiscoverSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const script = `
      (function() {
        const stores = [];

        // Redux
        if (window.__REDUX_DEVTOOLS_EXTENSION__ || window.__REDUX_STATE__) {
          stores.push({
            type: 'redux',
            found: true,
            location: '__REDUX_DEVTOOLS_EXTENSION__' in window ? 'devtools' : 'state',
          });
        }

        // Try to find Redux store in React root
        const reactRoot = document.getElementById('root') || document.getElementById('app');
        if (reactRoot?._reactRootContainer) {
          const fiber = reactRoot._reactRootContainer._internalRoot?.current;
          if (fiber) {
            stores.push({
              type: 'react-root',
              found: true,
              hasStore: !!fiber.memoizedState?.element?.props?.store,
            });
          }
        }

        // Zustand
        if (window.__ZUSTAND_DEVTOOLS_HOOK__) {
          stores.push({
            type: 'zustand',
            found: true,
            location: '__ZUSTAND_DEVTOOLS_HOOK__',
          });
        }

        // MobX
        if (window.__MOBX_DEVTOOLS_GLOBAL_HOOK__) {
          stores.push({
            type: 'mobx',
            found: true,
            location: '__MOBX_DEVTOOLS_GLOBAL_HOOK__',
          });
        }

        // Check for common store patterns in window
        const storePatterns = ['store', 'Store', '__store__', 'appStore'];
        for (const pattern of storePatterns) {
          if (window[pattern] && typeof window[pattern] === 'object') {
            const hasSubscribe = typeof window[pattern].subscribe === 'function';
            const hasGetState = typeof window[pattern].getState === 'function';
            const hasDispatch = typeof window[pattern].dispatch === 'function';

            if (hasSubscribe || hasGetState || hasDispatch) {
              stores.push({
                type: 'custom',
                found: true,
                location: pattern,
                hasSubscribe,
                hasGetState,
                hasDispatch,
              });
            }
          }
        }

        return { stores, count: stores.length };
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Evaluation failed',
      }, 500)
    }

    return c.json({
      success: true,
      data: evalResult.result.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Inspect React component tree
 */
export async function handleReactInspect(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = reactInspectSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const script = `
      (function() {
        const result = { found: false, reactVersion: null, components: [] };

        // Check for React
        if (!window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          return result;
        }

        result.found = true;

        // Get React version if available
        if (window.React?.version) {
          result.reactVersion = window.React.version;
        }

        const targetName = ${JSON.stringify(input.componentName || null)};
        const maxDepth = ${input.maxDepth};

        // Find fiber root
        const roots = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.getFiberRoots?.(1);
        if (!roots || roots.size === 0) {
          // Try alternate method
          const container = document.getElementById('root') || document.getElementById('app');
          if (container?._reactRootContainer) {
            const root = container._reactRootContainer._internalRoot?.current;
            if (root) {
              traverseFiber(root, 0);
            }
          }
          return result;
        }

        function traverseFiber(fiber, depth) {
          if (!fiber || depth > maxDepth) return;

          const name = fiber.type?.displayName || fiber.type?.name ||
                      (typeof fiber.type === 'string' ? fiber.type : null);

          if (name) {
            const include = !targetName || name.toLowerCase().includes(targetName.toLowerCase());
            if (include) {
              result.components.push({
                name,
                depth,
                hasState: !!fiber.memoizedState,
                hasProps: !!fiber.memoizedProps,
                key: fiber.key,
              });
            }
          }

          // Traverse children
          if (fiber.child) traverseFiber(fiber.child, depth + 1);
          if (fiber.sibling) traverseFiber(fiber.sibling, depth);
        }

        for (const root of roots) {
          if (root.current) {
            traverseFiber(root.current, 0);
          }
        }

        return result;
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Evaluation failed',
      }, 500)
    }

    return c.json({
      success: true,
      data: evalResult.result.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Enumerate Electron IPC channels
 */
export async function handleIpcEnumerate(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = ipcEnumerateSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const script = `
      (function() {
        const result = {
          isElectron: false,
          ipcRenderer: null,
          contextBridge: null,
          exposedApis: []
        };

        // Check if we're in Electron
        if (!window.process?.versions?.electron) {
          // Try alternate detection
          if (!window.require && !window.electron && !window.electronAPI) {
            return result;
          }
        }

        result.isElectron = true;

        // Check for exposed APIs via contextBridge
        const apiPatterns = ['electron', 'electronAPI', 'api', 'ipc', 'bridge'];
        for (const pattern of apiPatterns) {
          if (window[pattern] && typeof window[pattern] === 'object') {
            const methods = Object.keys(window[pattern]).filter(k =>
              typeof window[pattern][k] === 'function'
            );
            if (methods.length > 0) {
              result.exposedApis.push({
                name: pattern,
                methods,
              });
            }
          }
        }

        // Try to access ipcRenderer directly (may be restricted)
        try {
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (ipcRenderer) {
              result.ipcRenderer = {
                available: true,
                // Note: Can't easily enumerate listeners
              };
            }
          }
        } catch (e) {
          result.ipcRenderer = { available: false, error: e.message };
        }

        return result;
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Evaluation failed',
      }, 500)
    }

    return c.json({
      success: true,
      data: evalResult.result.value,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * List all running system processes
 */
export async function handleSystemProcessList(c: Context): Promise<Response> {
  try {
    const body = await c.req.json().catch(() => ({}))
    const input = processListSchema.parse(body)

    let processes = listProcesses()

    // Filter by name if specified
    if (input.filter) {
      const filterLower = input.filter.toLowerCase()
      processes = processes.filter((p) =>
        p.name.toLowerCase().includes(filterLower)
      )
    }

    return c.json({
      success: true,
      data: {
        processes,
        count: processes.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Get app info by PID
 */
export async function handleAppByPid(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = appByPidSchema.parse(body)

    const app = await discoverAppByPid(input.pid)

    if (!app) {
      return c.json({
        success: false,
        error: `Process not found: ${input.pid}`,
      }, 404)
    }

    return c.json({
      success: true,
      data: { app },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
