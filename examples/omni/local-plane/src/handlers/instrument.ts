/**
 * Instrumentation handlers - HTTP endpoints for function hooking and code injection
 *
 * These handlers enable the omni agent to instrument running applications
 * by hooking functions, intercepting IPC, and injecting scripts.
 */

import { z } from 'zod'
import type { Context } from 'hono'
import {
  getCDPSession,
  evaluateInContext,
} from '../introspect/cdp-client.js'

// ============ Input Schemas ============

const functionHookSchema = z.object({
  sessionId: z.string(),
  target: z.string().describe('Path to function (e.g., "window.fetch" or module path)'),
  hookType: z.enum(['wrap', 'before', 'after', 'replace']).default('wrap'),
  hookCode: z.string().optional().describe('JavaScript code for hook (receives args/result)'),
  logCalls: z.boolean().optional().default(true).describe('Log all calls to console'),
  hookId: z.string().optional().describe('Unique ID for this hook (auto-generated if not provided)'),
})

const functionReplaceSchema = z.object({
  sessionId: z.string(),
  target: z.string().describe('Path to function to replace'),
  replacement: z.string().describe('JavaScript code for replacement function'),
  hookId: z.string().optional(),
})

const ipcInterceptSchema = z.object({
  sessionId: z.string(),
  channel: z.string().describe('IPC channel name to intercept'),
  direction: z.enum(['send', 'receive', 'both']).default('both'),
  hookId: z.string().optional(),
})

const stateSubscribeSchema = z.object({
  sessionId: z.string(),
  storePath: z.string().describe('Path to store (e.g., "window.store")'),
  selector: z.string().optional().describe('State path to watch (e.g., "user.name")'),
  hookId: z.string().optional(),
})

const injectScriptSchema = z.object({
  sessionId: z.string(),
  script: z.string().describe('JavaScript code to inject'),
  persistent: z.boolean().optional().default(false).describe('Re-inject on navigation'),
})

const removeHookSchema = z.object({
  sessionId: z.string(),
  hookId: z.string(),
})

const listHooksSchema = z.object({
  sessionId: z.string(),
})

// ============ Hook Registry ============

// Track installed hooks per session
const hookRegistry: Map<string, Map<string, {
  type: string
  target: string
  installed: number
}>> = new Map()

function generateHookId(): string {
  return `hook-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`
}

function registerHook(sessionId: string, hookId: string, type: string, target: string) {
  if (!hookRegistry.has(sessionId)) {
    hookRegistry.set(sessionId, new Map())
  }
  hookRegistry.get(sessionId)!.set(hookId, {
    type,
    target,
    installed: Date.now(),
  })
}

function unregisterHook(sessionId: string, hookId: string): boolean {
  const hooks = hookRegistry.get(sessionId)
  if (!hooks) return false
  return hooks.delete(hookId)
}

// ============ Handlers ============

/**
 * Hook a function with pre/post callbacks
 */
export async function handleFunctionHook(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = functionHookSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const hookId = input.hookId || generateHookId()

    // Build the hook code based on type
    let hookScript: string

    switch (input.hookType) {
      case 'wrap':
        hookScript = `
          (function() {
            const target = ${input.target};
            if (typeof target !== 'function') {
              throw new Error('Target is not a function: ${input.target}');
            }

            const hookId = '${hookId}';
            const logCalls = ${input.logCalls};
            const customHook = ${input.hookCode || 'null'};

            // Store original
            window.__omni_hooks__ = window.__omni_hooks__ || {};
            window.__omni_hooks__[hookId] = { original: target, target: '${input.target}' };

            // Create wrapper
            const wrapper = function(...args) {
              if (logCalls) {
                console.log('[HOOK:${hookId}] ${input.target} called with:', args);
              }

              let modifiedArgs = args;
              if (customHook?.before) {
                modifiedArgs = customHook.before(args) || args;
              }

              const result = target.apply(this, modifiedArgs);

              if (result instanceof Promise) {
                return result.then(res => {
                  if (logCalls) {
                    console.log('[HOOK:${hookId}] ${input.target} returned:', res);
                  }
                  return customHook?.after ? (customHook.after(res) || res) : res;
                });
              }

              if (logCalls) {
                console.log('[HOOK:${hookId}] ${input.target} returned:', result);
              }
              return customHook?.after ? (customHook.after(result) || result) : result;
            };

            // Replace the function
            const parts = '${input.target}'.split('.');
            let obj = window;
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = wrapper;

            return { hookId, target: '${input.target}', type: 'wrap' };
          })()
        `
        break

      case 'before':
        hookScript = `
          (function() {
            const target = ${input.target};
            if (typeof target !== 'function') {
              throw new Error('Target is not a function: ${input.target}');
            }

            const hookId = '${hookId}';
            const beforeHook = ${input.hookCode || '(args) => { console.log("[BEFORE:${hookId}]", args); }'};

            window.__omni_hooks__ = window.__omni_hooks__ || {};
            window.__omni_hooks__[hookId] = { original: target, target: '${input.target}' };

            const wrapper = function(...args) {
              try { beforeHook(args); } catch (e) { console.error('[HOOK ERROR]', e); }
              return target.apply(this, args);
            };

            const parts = '${input.target}'.split('.');
            let obj = window;
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = wrapper;

            return { hookId, target: '${input.target}', type: 'before' };
          })()
        `
        break

      case 'after':
        hookScript = `
          (function() {
            const target = ${input.target};
            if (typeof target !== 'function') {
              throw new Error('Target is not a function: ${input.target}');
            }

            const hookId = '${hookId}';
            const afterHook = ${input.hookCode || '(result) => { console.log("[AFTER:${hookId}]", result); }'};

            window.__omni_hooks__ = window.__omni_hooks__ || {};
            window.__omni_hooks__[hookId] = { original: target, target: '${input.target}' };

            const wrapper = function(...args) {
              const result = target.apply(this, args);
              if (result instanceof Promise) {
                return result.then(res => {
                  try { afterHook(res); } catch (e) { console.error('[HOOK ERROR]', e); }
                  return res;
                });
              }
              try { afterHook(result); } catch (e) { console.error('[HOOK ERROR]', e); }
              return result;
            };

            const parts = '${input.target}'.split('.');
            let obj = window;
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = wrapper;

            return { hookId, target: '${input.target}', type: 'after' };
          })()
        `
        break

      default:
        return c.json({ success: false, error: `Unknown hook type: ${input.hookType}` }, 400)
    }

    const evalResult = await evaluateInContext(session, hookScript)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Hook installation failed',
      }, 500)
    }

    registerHook(input.sessionId, hookId, input.hookType, input.target)

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
 * Replace a function entirely
 */
export async function handleFunctionReplace(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = functionReplaceSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const hookId = input.hookId || generateHookId()

    const script = `
      (function() {
        const original = ${input.target};
        const hookId = '${hookId}';

        window.__omni_hooks__ = window.__omni_hooks__ || {};
        window.__omni_hooks__[hookId] = { original, target: '${input.target}', type: 'replace' };

        const replacement = ${input.replacement};

        const parts = '${input.target}'.split('.');
        let obj = window;
        for (let i = 0; i < parts.length - 1; i++) {
          obj = obj[parts[i]];
        }
        obj[parts[parts.length - 1]] = replacement;

        return { hookId, target: '${input.target}', type: 'replace' };
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Replacement failed',
      }, 500)
    }

    registerHook(input.sessionId, hookId, 'replace', input.target)

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
 * Intercept Electron IPC messages
 */
export async function handleIpcIntercept(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = ipcInterceptSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const hookId = input.hookId || generateHookId()

    const script = `
      (function() {
        const hookId = '${hookId}';
        const channel = '${input.channel}';
        const direction = '${input.direction}';

        window.__omni_hooks__ = window.__omni_hooks__ || {};

        // Find the IPC interface
        const ipc = window.electronAPI || window.electron || window.ipc;
        if (!ipc) {
          // Try require if available
          try {
            const { ipcRenderer } = window.require('electron');
            if (!ipcRenderer) throw new Error('No IPC access');
          } catch (e) {
            throw new Error('Cannot access Electron IPC: ' + e.message);
          }
        }

        const interceptor = {
          hookId,
          channel,
          direction,
          messages: [],
        };

        // Intercept send
        if (direction === 'send' || direction === 'both') {
          if (ipc.send) {
            const originalSend = ipc.send.bind(ipc);
            ipc.send = function(ch, ...args) {
              if (ch === channel || channel === '*') {
                console.log('[IPC:${hookId}] SEND', ch, args);
                interceptor.messages.push({ direction: 'send', channel: ch, args, time: Date.now() });
              }
              return originalSend(ch, ...args);
            };
          }
        }

        // Intercept receive
        if (direction === 'receive' || direction === 'both') {
          if (ipc.on) {
            const originalOn = ipc.on.bind(ipc);
            ipc.on = function(ch, listener) {
              if (ch === channel || channel === '*') {
                const wrappedListener = function(...args) {
                  console.log('[IPC:${hookId}] RECEIVE', ch, args);
                  interceptor.messages.push({ direction: 'receive', channel: ch, args, time: Date.now() });
                  return listener.apply(this, args);
                };
                return originalOn(ch, wrappedListener);
              }
              return originalOn(ch, listener);
            };
          }
        }

        window.__omni_hooks__[hookId] = interceptor;

        return { hookId, channel, direction, type: 'ipc-intercept' };
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'IPC intercept failed',
      }, 500)
    }

    registerHook(input.sessionId, hookId, 'ipc-intercept', input.channel)

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
 * Subscribe to state store changes
 */
export async function handleStateSubscribe(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = stateSubscribeSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const hookId = input.hookId || generateHookId()

    const script = `
      (function() {
        const hookId = '${hookId}';
        const storePath = '${input.storePath}';
        const selector = ${input.selector ? `'${input.selector}'` : 'null'};

        const store = ${input.storePath};
        if (!store) {
          throw new Error('Store not found at: ' + storePath);
        }

        window.__omni_hooks__ = window.__omni_hooks__ || {};

        const subscription = {
          hookId,
          storePath,
          selector,
          changes: [],
          lastState: null,
        };

        // Helper to get nested value
        function getNestedValue(obj, path) {
          if (!path) return obj;
          return path.split('.').reduce((o, k) => o?.[k], obj);
        }

        // Subscribe based on store type
        if (typeof store.subscribe === 'function') {
          // Redux-like store
          const unsubscribe = store.subscribe(() => {
            const state = typeof store.getState === 'function' ? store.getState() : store;
            const value = getNestedValue(state, selector);

            if (JSON.stringify(value) !== JSON.stringify(subscription.lastState)) {
              console.log('[STATE:${hookId}] Change detected:', selector || 'root', value);
              subscription.changes.push({
                time: Date.now(),
                path: selector,
                value: JSON.parse(JSON.stringify(value)),
              });
              subscription.lastState = JSON.parse(JSON.stringify(value));

              // Keep only last 50 changes
              if (subscription.changes.length > 50) {
                subscription.changes.shift();
              }
            }
          });

          subscription.unsubscribe = unsubscribe;
        } else {
          throw new Error('Store does not have a subscribe method');
        }

        window.__omni_hooks__[hookId] = subscription;

        // Get initial state
        const initialState = typeof store.getState === 'function' ? store.getState() : store;
        subscription.lastState = getNestedValue(initialState, selector);

        return { hookId, storePath, selector, type: 'state-subscribe', initialState: subscription.lastState };
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'State subscription failed',
      }, 500)
    }

    registerHook(input.sessionId, hookId, 'state-subscribe', input.storePath)

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
 * Inject arbitrary script into the page
 */
export async function handleInjectScript(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = injectScriptSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const evalResult = await evaluateInContext(session, input.script, {
      awaitPromise: true,
      returnByValue: true,
    })

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Script injection failed',
        data: { exception: evalResult.exceptionDetails },
      }, 500)
    }

    return c.json({
      success: true,
      data: {
        result: evalResult.result.value ?? evalResult.result.description,
        type: evalResult.result.type,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Remove a previously installed hook
 */
export async function handleRemoveHook(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = removeHookSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    const script = `
      (function() {
        const hookId = '${input.hookId}';
        const hooks = window.__omni_hooks__;

        if (!hooks || !hooks[hookId]) {
          return { removed: false, reason: 'Hook not found' };
        }

        const hook = hooks[hookId];

        // Restore original if available
        if (hook.original && hook.target) {
          try {
            const parts = hook.target.split('.');
            let obj = window;
            for (let i = 0; i < parts.length - 1; i++) {
              obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = hook.original;
          } catch (e) {
            console.warn('[HOOK] Failed to restore original:', e);
          }
        }

        // Call unsubscribe if available
        if (typeof hook.unsubscribe === 'function') {
          hook.unsubscribe();
        }

        delete hooks[hookId];

        return { removed: true, hookId };
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    if (evalResult.exceptionDetails) {
      return c.json({
        success: false,
        error: evalResult.exceptionDetails.exception?.description || 'Hook removal failed',
      }, 500)
    }

    unregisterHook(input.sessionId, input.hookId)

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
 * List all installed hooks for a session
 */
export async function handleListHooks(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = listHooksSchema.parse(body)

    const session = getCDPSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `CDP session not found: ${input.sessionId}`,
      }, 404)
    }

    // Get hooks from both registry and runtime
    const script = `
      (function() {
        const hooks = window.__omni_hooks__ || {};
        return Object.keys(hooks).map(id => ({
          hookId: id,
          target: hooks[id].target,
          type: hooks[id].type,
          hasOriginal: !!hooks[id].original,
        }));
      })()
    `

    const evalResult = await evaluateInContext(session, script)

    const registryHooks = hookRegistry.get(input.sessionId)
    const registryList = registryHooks
      ? Array.from(registryHooks.entries()).map(([id, info]) => ({
          hookId: id,
          ...info,
        }))
      : []

    return c.json({
      success: true,
      data: {
        runtime: evalResult.result.value,
        registry: registryList,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
