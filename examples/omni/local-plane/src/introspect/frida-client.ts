/**
 * Frida Client - Dynamic instrumentation framework client
 *
 * Provides session management and RPC communication with Frida
 * for attaching to and instrumenting native processes.
 */

import frida from 'frida'

// Type definitions
export type FridaSession = {
  id: string
  pid: number
  processName: string
  session: frida.Session
  scripts: Map<string, frida.Script>
  hooks: Map<string, HookInfo>
}

export type HookInfo = {
  id: string
  module: string
  function: string
  type: 'intercept' | 'replace'
  scriptId: string
}

export type ModuleInfo = {
  name: string
  base: string
  size: number
  path: string
}

export type ExportInfo = {
  type: 'function' | 'variable'
  name: string
  address: string
}

export type SessionInfo = {
  id: string
  pid: number
  processName: string
  activeScripts: number
  activeHooks: number
}

export type ScriptInfo = {
  id: string
  sessionId: string
}

// Active Frida sessions
const sessions: Map<string, FridaSession> = new Map()

/**
 * Generate session ID
 */
function generateSessionId(): string {
  return `frida-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate script ID
 */
function generateScriptId(): string {
  return `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate hook ID
 */
function generateHookId(): string {
  return `hook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * List all processes on the local device
 */
export async function listProcesses(): Promise<
  Array<{ pid: number; name: string }>
> {
  const device = await frida.getLocalDevice()
  const processes = await device.enumerateProcesses()
  return processes.map((p) => ({ pid: p.pid, name: p.name }))
}

/**
 * Attach to a running process by PID or name
 */
export async function attachToProcess(
  target: number | string
): Promise<SessionInfo> {
  const device = await frida.getLocalDevice()

  let pid: number
  let processName: string

  if (typeof target === 'number') {
    pid = target
    const processes = await device.enumerateProcesses()
    const proc = processes.find((p) => p.pid === target)
    processName = proc?.name ?? `pid-${target}`
  } else {
    // Find process by name
    const processes = await device.enumerateProcesses()
    const proc = processes.find(
      (p) => p.name.toLowerCase() === target.toLowerCase()
    )
    if (!proc) {
      throw new Error(`Process not found: ${target}`)
    }
    pid = proc.pid
    processName = proc.name
  }

  const session = await device.attach(pid)
  const sessionId = generateSessionId()

  const fridaSession: FridaSession = {
    id: sessionId,
    pid,
    processName,
    session,
    scripts: new Map(),
    hooks: new Map(),
  }

  // Handle session detach
  session.detached.connect((reason) => {
    console.log(`[Frida] Session ${sessionId} detached: ${reason}`)
    sessions.delete(sessionId)
  })

  sessions.set(sessionId, fridaSession)

  return {
    id: sessionId,
    pid,
    processName,
    activeScripts: 0,
    activeHooks: 0,
  }
}

/**
 * Spawn a new process with Frida attached
 */
export async function spawnProcess(
  program: string,
  args: string[] = [],
  cwd?: string,
  env?: Record<string, string>
): Promise<SessionInfo> {
  const device = await frida.getLocalDevice()

  const spawnOptions: frida.SpawnOptions = {}
  if (args.length > 0) {
    spawnOptions.argv = [program, ...args]
  }
  if (cwd) {
    spawnOptions.cwd = cwd
  }
  if (env) {
    spawnOptions.env = env
  }

  const pid = await device.spawn(program, spawnOptions)
  const session = await device.attach(pid)
  const sessionId = generateSessionId()

  // Get process name
  const processes = await device.enumerateProcesses()
  const proc = processes.find((p) => p.pid === pid)
  const processName = proc?.name ?? program.split('/').pop() ?? 'unknown'

  const fridaSession: FridaSession = {
    id: sessionId,
    pid,
    processName,
    session,
    scripts: new Map(),
    hooks: new Map(),
  }

  // Handle session detach
  session.detached.connect((reason) => {
    console.log(`[Frida] Session ${sessionId} detached: ${reason}`)
    sessions.delete(sessionId)
  })

  sessions.set(sessionId, fridaSession)

  // Resume the process (it starts suspended)
  await device.resume(pid)

  return {
    id: sessionId,
    pid,
    processName,
    activeScripts: 0,
    activeHooks: 0,
  }
}

/**
 * Detach from a process
 */
export async function detachSession(sessionId: string): Promise<void> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  // Unload all scripts
  for (const [, script] of fridaSession.scripts) {
    try {
      await script.unload()
    } catch {
      // Ignore errors during cleanup
    }
  }

  await fridaSession.session.detach()
  sessions.delete(sessionId)
}

/**
 * Get an existing Frida session
 */
export function getFridaSession(sessionId: string): FridaSession | undefined {
  return sessions.get(sessionId)
}

/**
 * List all active Frida sessions
 */
export function listFridaSessions(): SessionInfo[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    pid: s.pid,
    processName: s.processName,
    activeScripts: s.scripts.size,
    activeHooks: s.hooks.size,
  }))
}

/**
 * Load and run a Frida script in the target process
 */
export async function loadScript(
  sessionId: string,
  source: string,
  name?: string
): Promise<ScriptInfo> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(source, {
    name: name ?? 'agent',
  })

  // Handle script messages
  script.message.connect((message) => {
    if (message.type === 'send') {
      console.log(`[Frida Script ${sessionId}]`, message.payload)
    } else if (message.type === 'error') {
      console.error(`[Frida Script Error ${sessionId}]`, message.stack)
    }
  })

  await script.load()

  const scriptId = generateScriptId()
  fridaSession.scripts.set(scriptId, script)

  return {
    id: scriptId,
    sessionId,
  }
}

/**
 * Unload a script
 */
export async function unloadScript(
  sessionId: string,
  scriptId: string
): Promise<void> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = fridaSession.scripts.get(scriptId)
  if (!script) {
    throw new Error(`Script not found: ${scriptId}`)
  }

  await script.unload()
  fridaSession.scripts.delete(scriptId)

  // Remove any hooks associated with this script
  for (const [hookId, hook] of fridaSession.hooks) {
    if (hook.scriptId === scriptId) {
      fridaSession.hooks.delete(hookId)
    }
  }
}

/**
 * Enumerate loaded modules in the target process
 */
export async function enumerateModules(sessionId: string): Promise<ModuleInfo[]> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      enumerateModules: function() {
        return Process.enumerateModules().map(m => ({
          name: m.name,
          base: m.base.toString(),
          size: m.size,
          path: m.path
        }));
      }
    };
  `)

  await script.load()

  try {
    const modules = (await script.exports.enumerateModules()) as ModuleInfo[]
    return modules
  } finally {
    await script.unload()
  }
}

/**
 * Enumerate exports of a specific module
 */
export async function enumerateExports(
  sessionId: string,
  moduleName: string
): Promise<ExportInfo[]> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      enumerateExports: function(moduleName) {
        return Module.enumerateExports(moduleName).map(e => ({
          type: e.type,
          name: e.name,
          address: e.address.toString()
        }));
      }
    };
  `)

  await script.load()

  try {
    const exports = (await script.exports.enumerateExports(
      moduleName
    )) as ExportInfo[]
    return exports
  } finally {
    await script.unload()
  }
}

/**
 * Enumerate classes (ObjC on macOS/iOS, Java on Android)
 */
export async function enumerateClasses(sessionId: string): Promise<string[]> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      enumerateClasses: function() {
        if (ObjC.available) {
          return ObjC.classes ? Object.keys(ObjC.classes) : [];
        }
        if (Java.available) {
          var classes = [];
          Java.perform(function() {
            Java.enumerateLoadedClasses({
              onMatch: function(className) {
                classes.push(className);
              },
              onComplete: function() {}
            });
          });
          return classes;
        }
        return [];
      }
    };
  `)

  await script.load()

  try {
    const classes = (await script.exports.enumerateClasses()) as string[]
    return classes
  } finally {
    await script.unload()
  }
}

/**
 * Intercept a function with onEnter/onLeave callbacks
 */
export async function interceptFunction(
  sessionId: string,
  options: {
    module: string
    function: string
    onEnter?: string // JavaScript code for onEnter callback
    onLeave?: string // JavaScript code for onLeave callback
  }
): Promise<{ hookId: string; scriptId: string }> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const { module, function: funcName, onEnter, onLeave } = options

  // Build the interceptor script
  const scriptSource = `
    (function() {
      var targetModule = Module.findExportByName(${JSON.stringify(module)}, ${JSON.stringify(funcName)});
      if (!targetModule) {
        throw new Error('Function not found: ' + ${JSON.stringify(funcName)} + ' in ' + ${JSON.stringify(module)});
      }

      Interceptor.attach(targetModule, {
        onEnter: function(args) {
          ${onEnter ?? '// No onEnter callback'}
        },
        onLeave: function(retval) {
          ${onLeave ?? '// No onLeave callback'}
        }
      });

      send({ type: 'hooked', module: ${JSON.stringify(module)}, function: ${JSON.stringify(funcName)} });
    })();
  `

  const script = await fridaSession.session.createScript(scriptSource, {
    name: `hook-${module}-${funcName}`,
  })

  script.message.connect((message) => {
    if (message.type === 'send') {
      console.log(`[Frida Hook ${sessionId}]`, message.payload)
    } else if (message.type === 'error') {
      console.error(`[Frida Hook Error ${sessionId}]`, message.stack)
    }
  })

  await script.load()

  const scriptId = generateScriptId()
  const hookId = generateHookId()

  fridaSession.scripts.set(scriptId, script)
  fridaSession.hooks.set(hookId, {
    id: hookId,
    module,
    function: funcName,
    type: 'intercept',
    scriptId,
  })

  return { hookId, scriptId }
}

/**
 * Replace a function entirely
 */
export async function replaceFunction(
  sessionId: string,
  options: {
    module: string
    function: string
    implementation: string // JavaScript code for the replacement function
    returnType?: string // e.g., 'void', 'int', 'pointer' (default: 'void')
    argTypes?: string[] // e.g., ['int', 'pointer'] (default: [])
  }
): Promise<{ hookId: string; scriptId: string }> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const { module, function: funcName, implementation, returnType = 'void', argTypes = [] } = options

  const scriptSource = `
    (function() {
      var targetModule = Module.findExportByName(${JSON.stringify(module)}, ${JSON.stringify(funcName)});
      if (!targetModule) {
        throw new Error('Function not found: ' + ${JSON.stringify(funcName)} + ' in ' + ${JSON.stringify(module)});
      }

      Interceptor.replace(targetModule, new NativeCallback(function() {
        ${implementation}
      }, ${JSON.stringify(returnType)}, ${JSON.stringify(argTypes)}));

      send({ type: 'replaced', module: ${JSON.stringify(module)}, function: ${JSON.stringify(funcName)} });
    })();
  `

  const script = await fridaSession.session.createScript(scriptSource, {
    name: `replace-${module}-${funcName}`,
  })

  script.message.connect((message) => {
    if (message.type === 'send') {
      console.log(`[Frida Replace ${sessionId}]`, message.payload)
    } else if (message.type === 'error') {
      console.error(`[Frida Replace Error ${sessionId}]`, message.stack)
    }
  })

  await script.load()

  const scriptId = generateScriptId()
  const hookId = generateHookId()

  fridaSession.scripts.set(scriptId, script)
  fridaSession.hooks.set(hookId, {
    id: hookId,
    module,
    function: funcName,
    type: 'replace',
    scriptId,
  })

  return { hookId, scriptId }
}

/**
 * Call a native function directly
 */
export async function callFunction(
  sessionId: string,
  options: {
    module: string
    function: string
    returnType: string // e.g., 'int', 'void', 'pointer'
    argTypes: string[] // e.g., ['int', 'pointer']
    args: unknown[] // Actual arguments
  }
): Promise<unknown> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const { module, function: funcName, returnType, argTypes, args } = options

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      callFunction: function(module, funcName, returnType, argTypes, args) {
        var targetAddr = Module.findExportByName(module, funcName);
        if (!targetAddr) {
          throw new Error('Function not found: ' + funcName + ' in ' + module);
        }

        var nativeFunc = new NativeFunction(targetAddr, returnType, argTypes);
        return nativeFunc.apply(null, args);
      }
    };
  `)

  await script.load()

  try {
    const result = await script.exports.callFunction(
      module,
      funcName,
      returnType,
      argTypes,
      args
    )
    return result
  } finally {
    await script.unload()
  }
}

/**
 * Remove a hook
 */
export async function removeHook(
  sessionId: string,
  hookId: string
): Promise<void> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const hook = fridaSession.hooks.get(hookId)
  if (!hook) {
    throw new Error(`Hook not found: ${hookId}`)
  }

  // Unload the script associated with the hook
  const script = fridaSession.scripts.get(hook.scriptId)
  if (script) {
    await script.unload()
    fridaSession.scripts.delete(hook.scriptId)
  }

  fridaSession.hooks.delete(hookId)
}

/**
 * List all hooks for a session
 */
export function listHooks(sessionId: string): HookInfo[] {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  return Array.from(fridaSession.hooks.values())
}

/**
 * Evaluate arbitrary JavaScript in the target process
 */
export async function evaluate(
  sessionId: string,
  expression: string
): Promise<unknown> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      evaluate: function(code) {
        return eval(code);
      }
    };
  `)

  await script.load()

  try {
    const result = await script.exports.evaluate(expression)
    return result
  } finally {
    await script.unload()
  }
}

/**
 * Get memory at an address
 */
export async function readMemory(
  sessionId: string,
  address: string,
  size: number
): Promise<string> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      readMemory: function(address, size) {
        var p = ptr(address);
        var bytes = p.readByteArray(size);
        return bytes ? Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, '0')).join('') : '';
      }
    };
  `)

  await script.load()

  try {
    const result = (await script.exports.readMemory(address, size)) as string
    return result
  } finally {
    await script.unload()
  }
}

/**
 * Write memory at an address
 */
export async function writeMemory(
  sessionId: string,
  address: string,
  hexData: string
): Promise<void> {
  const fridaSession = sessions.get(sessionId)
  if (!fridaSession) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const script = await fridaSession.session.createScript(`
    rpc.exports = {
      writeMemory: function(address, hexData) {
        var p = ptr(address);
        var bytes = [];
        for (var i = 0; i < hexData.length; i += 2) {
          bytes.push(parseInt(hexData.substr(i, 2), 16));
        }
        p.writeByteArray(bytes);
      }
    };
  `)

  await script.load()

  try {
    await script.exports.writeMemory(address, hexData)
  } finally {
    await script.unload()
  }
}
