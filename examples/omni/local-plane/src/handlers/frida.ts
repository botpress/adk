/**
 * Frida handlers - HTTP endpoints for native process instrumentation
 *
 * These handlers enable the omni agent to attach to, instrument,
 * and automate native applications using Frida.
 */

import { z } from 'zod'
import type { Context } from 'hono'
import {
  attachToProcess,
  spawnProcess,
  detachSession,
  getFridaSession,
  listFridaSessions,
  listProcesses,
  loadScript,
  unloadScript,
  enumerateModules,
  enumerateExports,
  enumerateClasses,
  interceptFunction,
  replaceFunction,
  callFunction,
  removeHook,
  listHooks,
  evaluate,
  readMemory,
  writeMemory,
} from '../introspect/frida-client.js'

// ============ Input Schemas ============

const fridaAttachSchema = z.object({
  target: z.union([
    z.number().describe('Process ID to attach to'),
    z.string().describe('Process name to attach to'),
  ]),
})

const fridaSpawnSchema = z.object({
  program: z.string().describe('Path to the program to spawn'),
  args: z.array(z.string()).optional().default([]),
  cwd: z.string().optional().describe('Working directory'),
  env: z.record(z.string()).optional().describe('Environment variables'),
})

const fridaDetachSchema = z.object({
  sessionId: z.string(),
})

const fridaModulesSchema = z.object({
  sessionId: z.string(),
})

const fridaExportsSchema = z.object({
  sessionId: z.string(),
  module: z.string().describe('Module name to enumerate exports from'),
})

const fridaClassesSchema = z.object({
  sessionId: z.string(),
})

const fridaInterceptSchema = z.object({
  sessionId: z.string(),
  module: z.string().describe('Module containing the function (e.g., "libc.so", "libSystem.B.dylib")'),
  function: z.string().describe('Function name to intercept'),
  onEnter: z.string().optional().describe('JavaScript code for onEnter callback. Has access to "args" array.'),
  onLeave: z.string().optional().describe('JavaScript code for onLeave callback. Has access to "retval".'),
})

const fridaReplaceSchema = z.object({
  sessionId: z.string(),
  module: z.string().describe('Module containing the function'),
  function: z.string().describe('Function name to replace'),
  implementation: z.string().describe('JavaScript code for the replacement function'),
  returnType: z.string().optional().default('void').describe('Return type (e.g., "void", "int", "pointer")'),
  argTypes: z.array(z.string()).optional().default([]).describe('Argument types (e.g., ["int", "pointer"])'),
})

const fridaCallSchema = z.object({
  sessionId: z.string(),
  module: z.string().describe('Module containing the function'),
  function: z.string().describe('Function name to call'),
  returnType: z.string().describe('Return type (e.g., "int", "void", "pointer")'),
  argTypes: z.array(z.string()).describe('Argument types (e.g., ["int", "pointer"])'),
  args: z.array(z.unknown()).describe('Arguments to pass to the function'),
})

const fridaScriptSchema = z.object({
  sessionId: z.string(),
  source: z.string().describe('Frida script source code'),
  name: z.string().optional().describe('Optional name for the script'),
})

const fridaUnloadScriptSchema = z.object({
  sessionId: z.string(),
  scriptId: z.string(),
})

const fridaRemoveHookSchema = z.object({
  sessionId: z.string(),
  hookId: z.string(),
})

const fridaListHooksSchema = z.object({
  sessionId: z.string(),
})

const fridaEvaluateSchema = z.object({
  sessionId: z.string(),
  expression: z.string().describe('JavaScript expression to evaluate in the target process'),
})

const fridaMemoryReadSchema = z.object({
  sessionId: z.string(),
  address: z.string().describe('Memory address (as hex string, e.g., "0x7fff12345678")'),
  size: z.number().describe('Number of bytes to read'),
})

const fridaMemoryWriteSchema = z.object({
  sessionId: z.string(),
  address: z.string().describe('Memory address (as hex string)'),
  data: z.string().describe('Hex-encoded data to write'),
})

const fridaProcessListSchema = z.object({
  filter: z.string().optional().describe('Filter by process name (partial match)'),
})

// ============ Handlers ============

/**
 * List running processes (available for Frida attach)
 */
export async function handleFridaProcessList(c: Context): Promise<Response> {
  try {
    const body = await c.req.json().catch(() => ({}))
    const input = fridaProcessListSchema.parse(body)

    let processes = await listProcesses()

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
 * Attach to a running process
 */
export async function handleFridaAttach(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaAttachSchema.parse(body)

    const session = await attachToProcess(input.target)

    return c.json({
      success: true,
      data: session,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Spawn a new process with Frida attached
 */
export async function handleFridaSpawn(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaSpawnSchema.parse(body)

    const session = await spawnProcess(
      input.program,
      input.args,
      input.cwd,
      input.env
    )

    return c.json({
      success: true,
      data: session,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Detach from a process
 */
export async function handleFridaDetach(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaDetachSchema.parse(body)

    await detachSession(input.sessionId)

    return c.json({
      success: true,
      data: { detached: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * List active Frida sessions
 */
export async function handleFridaListSessions(c: Context): Promise<Response> {
  const sessions = listFridaSessions()

  return c.json({
    success: true,
    data: { sessions, count: sessions.length },
  })
}

/**
 * Enumerate loaded modules in the target process
 */
export async function handleFridaEnumerateModules(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaModulesSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const modules = await enumerateModules(input.sessionId)

    return c.json({
      success: true,
      data: {
        modules,
        count: modules.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Enumerate exports from a specific module
 */
export async function handleFridaEnumerateExports(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaExportsSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const exports = await enumerateExports(input.sessionId, input.module)

    return c.json({
      success: true,
      data: {
        exports,
        count: exports.length,
        module: input.module,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Enumerate classes (ObjC on macOS/iOS, Java on Android)
 */
export async function handleFridaEnumerateClasses(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaClassesSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const classes = await enumerateClasses(input.sessionId)

    return c.json({
      success: true,
      data: {
        classes,
        count: classes.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Intercept a function with onEnter/onLeave callbacks
 */
export async function handleFridaIntercept(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaInterceptSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await interceptFunction(input.sessionId, {
      module: input.module,
      function: input.function,
      onEnter: input.onEnter,
      onLeave: input.onLeave,
    })

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Replace a function entirely
 */
export async function handleFridaReplace(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaReplaceSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await replaceFunction(input.sessionId, {
      module: input.module,
      function: input.function,
      implementation: input.implementation,
      returnType: input.returnType,
      argTypes: input.argTypes,
    })

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Call a native function directly
 */
export async function handleFridaCall(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaCallSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await callFunction(input.sessionId, {
      module: input.module,
      function: input.function,
      returnType: input.returnType,
      argTypes: input.argTypes,
      args: input.args,
    })

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
 * Load a custom Frida script
 */
export async function handleFridaLoadScript(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaScriptSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await loadScript(input.sessionId, input.source, input.name)

    return c.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Unload a Frida script
 */
export async function handleFridaUnloadScript(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaUnloadScriptSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    await unloadScript(input.sessionId, input.scriptId)

    return c.json({
      success: true,
      data: { unloaded: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Remove a hook
 */
export async function handleFridaRemoveHook(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaRemoveHookSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    await removeHook(input.sessionId, input.hookId)

    return c.json({
      success: true,
      data: { removed: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * List active hooks for a session
 */
export async function handleFridaListHooks(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaListHooksSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const hooks = listHooks(input.sessionId)

    return c.json({
      success: true,
      data: { hooks, count: hooks.length },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Evaluate JavaScript in the target process
 */
export async function handleFridaEvaluate(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaEvaluateSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const result = await evaluate(input.sessionId, input.expression)

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
 * Read memory from target process
 */
export async function handleFridaMemoryRead(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaMemoryReadSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    const data = await readMemory(input.sessionId, input.address, input.size)

    return c.json({
      success: true,
      data: {
        address: input.address,
        size: input.size,
        hex: data,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}

/**
 * Write memory to target process
 */
export async function handleFridaMemoryWrite(c: Context): Promise<Response> {
  try {
    const body = await c.req.json()
    const input = fridaMemoryWriteSchema.parse(body)

    const session = getFridaSession(input.sessionId)
    if (!session) {
      return c.json({
        success: false,
        error: `Frida session not found: ${input.sessionId}`,
      }, 404)
    }

    await writeMemory(input.sessionId, input.address, input.data)

    return c.json({
      success: true,
      data: { written: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return c.json({ success: false, error: message }, 500)
  }
}
