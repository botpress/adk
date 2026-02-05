#!/usr/bin/env node
import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { authMiddleware, validateEnvironment, getWorkspacePath, initializeToken } from './auth.js'
import { seedWorkspace } from './seed.js'
import { handleBash } from './handlers/bash.js'
import { handleFileRead, handleFileWrite } from './handlers/file.js'
import { handleFileEdit } from './handlers/file-edit.js'
import { handleGrep } from './handlers/file-grep.js'
import { handleGlob } from './handlers/file-glob.js'
import { handleLs } from './handlers/file-ls.js'
import { handleContextLoad } from './handlers/context.js'
import { handleMemoryRead, handleMemoryWrite } from './handlers/memory.js'
import {
  handleProcessSpawn,
  handleProcessSendKeys,
  handleProcessRead,
  handleProcessKill,
  handleProcessList,
  handleProcessResize,
} from './handlers/process.js'
import {
  handleBrowserLaunch,
  handleBrowserNavigate,
  handleBrowserSnapshot,
  handleBrowserClick,
  handleBrowserType,
  handleBrowserHover,
  handleBrowserScroll,
  handleBrowserPressKey,
  handleBrowserSelectOption,
  handleBrowserScreenshot,
  handleBrowserExtract,
  handleBrowserExecute,
  handleBrowserWait,
  handleBrowserClose,
  handleBrowserList,
  handleBrowserConsole,
  handleBrowserErrors,
  // Phase 1: Core Interactions
  handleBrowserDrag,
  handleBrowserFillForm,
  handleBrowserDialog,
  // Phase 2: File Operations
  handleBrowserUpload,
  handleBrowserDownload,
  handleBrowserPdf,
  // Phase 3: State & Storage
  handleBrowserCookiesGet,
  handleBrowserCookiesSet,
  handleBrowserCookiesClear,
  handleBrowserStorageGet,
  handleBrowserStorageSet,
  handleBrowserStorageClear,
  // Phase 4: Network & Debugging
  handleBrowserNetwork,
  handleBrowserResponse,
  handleBrowserTraceStart,
  handleBrowserTraceStop,
  // Phase 5: Environment Emulation
  handleBrowserEmulateDevice,
  handleBrowserGeolocation,
  handleBrowserTimezone,
  handleBrowserLocale,
  handleBrowserOffline,
  handleBrowserHeaders,
} from './handlers/browser.js'
import {
  handleAppDiscover,
  handleAppLaunch,
  handleCdpConnect,
  handleCdpTargets,
  handleCdpEvaluate,
  handleCdpCommand,
  handleCdpDom,
  handleCdpScreenshot,
  handleCdpClose,
  handleCdpList,
  handleModuleTraverse,
  handleStoreDiscover,
  handleReactInspect,
  handleIpcEnumerate,
  handleSystemProcessList,
  handleAppByPid,
} from './handlers/introspect.js'
import {
  handleFunctionHook,
  handleFunctionReplace,
  handleIpcIntercept,
  handleStateSubscribe,
  handleInjectScript,
  handleRemoveHook,
  handleListHooks,
} from './handlers/instrument.js'
import {
  handleFridaProcessList,
  handleFridaAttach,
  handleFridaSpawn,
  handleFridaDetach,
  handleFridaListSessions,
  handleFridaEnumerateModules,
  handleFridaEnumerateExports,
  handleFridaEnumerateClasses,
  handleFridaIntercept,
  handleFridaReplace,
  handleFridaCall,
  handleFridaLoadScript,
  handleFridaUnloadScript,
  handleFridaRemoveHook,
  handleFridaListHooks,
  handleFridaEvaluate,
  handleFridaMemoryRead,
  handleFridaMemoryWrite,
} from './handlers/frida.js'
import { handleSkillsList } from './handlers/skills.js'

// Create the Hono app
const app = new Hono()

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ success: true, data: { ok: true } })
})

// Apply auth middleware to all other routes
app.use('*', authMiddleware)

// Bash endpoint
app.post('/bash', handleBash)

// File endpoints
app.post('/file/read', handleFileRead)
app.post('/file/write', handleFileWrite)
app.post('/file/edit', handleFileEdit)
app.post('/file/grep', handleGrep)
app.post('/file/glob', handleGlob)
app.post('/file/ls', handleLs)

// Context endpoint
app.post('/context/load', handleContextLoad)

// Memory endpoints
app.post('/memory/read', handleMemoryRead)
app.post('/memory/write', handleMemoryWrite)

// Process/PTY endpoints
app.post('/process/spawn', handleProcessSpawn)
app.post('/process/send-keys', handleProcessSendKeys)
app.post('/process/read', handleProcessRead)
app.post('/process/kill', handleProcessKill)
app.post('/process/list', handleProcessList)
app.post('/process/resize', handleProcessResize)

// Browser automation endpoints (Playwright)
app.post('/browser/launch', handleBrowserLaunch)
app.post('/browser/navigate', handleBrowserNavigate)
app.post('/browser/snapshot', handleBrowserSnapshot)
app.post('/browser/click', handleBrowserClick)
app.post('/browser/type', handleBrowserType)
app.post('/browser/hover', handleBrowserHover)
app.post('/browser/scroll', handleBrowserScroll)
app.post('/browser/press-key', handleBrowserPressKey)
app.post('/browser/select-option', handleBrowserSelectOption)
app.post('/browser/screenshot', handleBrowserScreenshot)
app.post('/browser/extract', handleBrowserExtract)
app.post('/browser/execute', handleBrowserExecute)
app.post('/browser/wait', handleBrowserWait)
app.post('/browser/close', handleBrowserClose)
app.get('/browser/list', handleBrowserList)
app.post('/browser/console', handleBrowserConsole)
app.post('/browser/errors', handleBrowserErrors)
// Phase 1: Core Interactions
app.post('/browser/drag', handleBrowserDrag)
app.post('/browser/fill-form', handleBrowserFillForm)
app.post('/browser/dialog', handleBrowserDialog)
// Phase 2: File Operations
app.post('/browser/upload', handleBrowserUpload)
app.post('/browser/download', handleBrowserDownload)
app.post('/browser/pdf', handleBrowserPdf)
// Phase 3: State & Storage
app.post('/browser/cookies/get', handleBrowserCookiesGet)
app.post('/browser/cookies/set', handleBrowserCookiesSet)
app.post('/browser/cookies/clear', handleBrowserCookiesClear)
app.post('/browser/storage/get', handleBrowserStorageGet)
app.post('/browser/storage/set', handleBrowserStorageSet)
app.post('/browser/storage/clear', handleBrowserStorageClear)
// Phase 4: Network & Debugging
app.post('/browser/network', handleBrowserNetwork)
app.post('/browser/response', handleBrowserResponse)
app.post('/browser/trace/start', handleBrowserTraceStart)
app.post('/browser/trace/stop', handleBrowserTraceStop)
// Phase 5: Environment Emulation
app.post('/browser/emulate-device', handleBrowserEmulateDevice)
app.post('/browser/geolocation', handleBrowserGeolocation)
app.post('/browser/timezone', handleBrowserTimezone)
app.post('/browser/locale', handleBrowserLocale)
app.post('/browser/offline', handleBrowserOffline)
app.post('/browser/headers', handleBrowserHeaders)

// App introspection endpoints
app.post('/introspect/apps', handleAppDiscover)
app.post('/introspect/app-by-pid', handleAppByPid)
app.post('/introspect/processes', handleSystemProcessList)
app.post('/introspect/launch', handleAppLaunch)
app.post('/introspect/cdp/connect', handleCdpConnect)
app.post('/introspect/cdp/targets', handleCdpTargets)
app.post('/introspect/cdp/evaluate', handleCdpEvaluate)
app.post('/introspect/cdp/command', handleCdpCommand)
app.post('/introspect/cdp/dom', handleCdpDom)
app.post('/introspect/cdp/screenshot', handleCdpScreenshot)
app.post('/introspect/cdp/close', handleCdpClose)
app.get('/introspect/cdp/list', handleCdpList)
app.post('/introspect/modules', handleModuleTraverse)
app.post('/introspect/stores', handleStoreDiscover)
app.post('/introspect/react', handleReactInspect)
app.post('/introspect/ipc', handleIpcEnumerate)

// Instrumentation endpoints
app.post('/instrument/hook', handleFunctionHook)
app.post('/instrument/replace', handleFunctionReplace)
app.post('/instrument/ipc-intercept', handleIpcIntercept)
app.post('/instrument/state-subscribe', handleStateSubscribe)
app.post('/instrument/inject', handleInjectScript)
app.post('/instrument/remove-hook', handleRemoveHook)
app.post('/instrument/list-hooks', handleListHooks)

// Frida endpoints (native process instrumentation)
app.post('/frida/processes', handleFridaProcessList)
app.post('/frida/attach', handleFridaAttach)
app.post('/frida/spawn', handleFridaSpawn)
app.post('/frida/detach', handleFridaDetach)
app.post('/frida/sessions', handleFridaListSessions)
app.post('/frida/modules', handleFridaEnumerateModules)
app.post('/frida/exports', handleFridaEnumerateExports)
app.post('/frida/classes', handleFridaEnumerateClasses)
app.post('/frida/intercept', handleFridaIntercept)
app.post('/frida/replace', handleFridaReplace)
app.post('/frida/call', handleFridaCall)
app.post('/frida/script', handleFridaLoadScript)
app.post('/frida/script/unload', handleFridaUnloadScript)
app.post('/frida/hook/remove', handleFridaRemoveHook)
app.post('/frida/hooks', handleFridaListHooks)
app.post('/frida/evaluate', handleFridaEvaluate)
app.post('/frida/memory/read', handleFridaMemoryRead)
app.post('/frida/memory/write', handleFridaMemoryWrite)

// Skills endpoint
app.get('/skills/list', handleSkillsList)

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ success: false, error: err.message ?? 'Internal server error' }, 500)
})

// Not found handler
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404)
})

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  const port = parseInt(process.env['PORT'] ?? '3005', 10)
  const host = process.env['HOST'] ?? '127.0.0.1'

  // Validate environment
  const envCheck = validateEnvironment()
  if (!envCheck.valid) {
    console.error('Missing required environment variables:', envCheck.missing.join(', '))
    console.error('Set WORKSPACE_PATH to your workspace directory.')
    process.exit(1)
  }

  const workspace = getWorkspacePath()

  // Seed workspace with default files if needed
  const seeded = await seedWorkspace(workspace)
  if (seeded.length > 0) {
    console.log('Seeded workspace:')
    for (const file of seeded) {
      console.log(`  Created: ${file}`)
    }
  }

  // Initialize auth token
  const { token, generated } = initializeToken()

  console.log('Starting Omni Local Plane server...')
  console.log(`  Workspace: ${workspace}`)
  console.log(`  Listening: http://${host}:${port}`)
  if (generated) {
    console.log(`  Token: ${token} (auto-generated)`)
  } else {
    console.log(`  Token: (using LOCAL_PLANE_TOKEN from env)`)
  }

  serve({
    fetch: app.fetch,
    port,
    hostname: host,
  })

  console.log('Server started. Press Ctrl+C to stop.')
}

// Run if executed directly
startServer()

export { app, startServer }
