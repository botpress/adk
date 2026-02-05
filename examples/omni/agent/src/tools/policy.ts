import type { ToolPolicy, ToolDefinition } from './types.js'

/**
 * Built-in tool groups for bulk allow/deny
 */
export const TOOL_GROUPS: Record<string, string[]> = {
  // Core local tools
  'group:local': ['bash', 'file_read', 'file_write', 'file_edit', 'file_grep', 'file_glob', 'file_ls'],
  'group:memory': ['context_load', 'memory_read', 'memory_write'],
  'group:delegation': ['delegate'],
  'group:filesystem': ['file_read', 'file_write', 'file_edit', 'file_grep', 'file_glob', 'file_ls'],
  'group:coding': ['file_read', 'file_write', 'file_edit', 'file_grep', 'file_glob', 'file_ls', 'bash'],
  'group:skills': ['skill_list', 'skill_info', 'skill_install', 'skill_setup', 'skill_prompt'],

  // Process/PTY tools
  'group:process': ['process_spawn', 'process_send_keys', 'process_read', 'process_kill', 'process_list', 'process_resize'],

  // Browser automation tools (Playwright)
  'group:browser': [
    'browser_launch',
    'browser_navigate',
    'browser_snapshot',
    'browser_click',
    'browser_type',
    'browser_hover',
    'browser_scroll',
    'browser_press_key',
    'browser_select_option',
    'browser_screenshot',
    'browser_extract',
    'browser_execute',
    'browser_wait',
    'browser_close',
    'browser_console',
    'browser_errors',
    // Phase 1: Core Interactions
    'browser_drag',
    'browser_fill_form',
    'browser_dialog',
    // Phase 2: File Operations
    'browser_upload',
    'browser_download',
    'browser_pdf',
    // Phase 3: State & Storage
    'browser_cookies_get',
    'browser_cookies_set',
    'browser_cookies_clear',
    'browser_storage_get',
    'browser_storage_set',
    'browser_storage_clear',
    // Phase 4: Network & Debugging
    'browser_network',
    'browser_response',
    'browser_trace_start',
    'browser_trace_stop',
    // Phase 5: Environment Emulation
    'browser_emulate_device',
    'browser_geolocation',
    'browser_timezone',
    'browser_locale',
    'browser_offline',
    'browser_headers',
  ],

  // App introspection tools (CDP, module traversal, etc.)
  'group:introspect': [
    'app_discover',
    'cdp_connect',
    'cdp_evaluate',
    'cdp_dom',
    'cdp_targets',
    'cdp_close',
    'module_traverse',
    'store_discover',
    'react_inspect',
    'ipc_enumerate',
  ],

  // App instrumentation tools (hooking, injection)
  'group:instrument': [
    'function_hook',
    'function_replace',
    'ipc_intercept',
    'state_subscribe',
    'inject_script',
    'hook_remove',
    'hook_list',
  ],

  // Skill generation tools
  'group:skill-gen': [
    'skill_draft',
    'skill_upsert',
    'skill_query',
    'skill_get',
  ],

  // App automation tools (executable automation scripts)
  'group:app-automation': [
    'automation_upsert',
    'automation_query',
    'automation_get',
    'automation_run',
  ],

  // Frida tools (native process instrumentation)
  'group:frida': [
    'frida_process_list',
    'frida_attach',
    'frida_spawn',
    'frida_detach',
    'frida_sessions',
    'frida_modules',
    'frida_exports',
    'frida_classes',
    'frida_intercept',
    'frida_replace',
    'frida_call',
    'frida_remove_hook',
    'frida_list_hooks',
    'frida_script',
    'frida_unload_script',
    'frida_evaluate',
    'frida_memory_read',
    'frida_memory_write',
  ],

  // All tools wildcard
  'group:all': ['*'],
}

/**
 * Preset tool profiles (combinations of groups/tools)
 */
export const TOOL_PROFILES: Record<string, ToolPolicy> = {
  minimal: {
    allow: ['context_load'],
  },
  coding: {
    allow: ['group:coding', 'group:memory', 'group:process'],
  },
  full: {
    allow: ['group:all'],
  },
}

/**
 * Expand group references in a list to their constituent tool names
 *
 * @example
 * expandGroups(['group:local', 'custom_tool'])
 * // => ['bash', 'file_read', 'file_write', 'git', 'custom_tool']
 */
export function expandGroups(items: string[]): string[] {
  const result: string[] = []

  for (const item of items) {
    if (item.startsWith('group:')) {
      const groupTools = TOOL_GROUPS[item]
      if (groupTools) {
        result.push(...groupTools)
      }
    } else {
      result.push(item)
    }
  }

  return [...new Set(result)] // deduplicate
}

/**
 * Check if a tool name matches an allow pattern
 * Handles the special '*' wildcard for group:all
 */
function matchesTool(toolName: string, pattern: string): boolean {
  return pattern === '*' || pattern === toolName
}

/**
 * Determine if a specific tool is allowed by a policy
 */
export function isToolAllowed(toolName: string, policy: ToolPolicy): boolean {
  // Build the effective allow list
  let allowed: string[] = []

  // Start with profile defaults
  if (policy.profile && TOOL_PROFILES[policy.profile]) {
    const profilePolicy = TOOL_PROFILES[policy.profile]
    if (profilePolicy.allow) {
      allowed = expandGroups(profilePolicy.allow)
    }
  }

  // Add explicit allow list
  if (policy.allow) {
    allowed = [...allowed, ...expandGroups(policy.allow)]
  }

  // Add alsoAllow (additive)
  if (policy.alsoAllow) {
    allowed = [...allowed, ...expandGroups(policy.alsoAllow)]
  }

  // Check deny list first (deny wins over allow)
  if (policy.deny) {
    const denied = expandGroups(policy.deny)
    if (denied.some((pattern) => matchesTool(toolName, pattern))) {
      return false
    }
  }

  // Check if tool is in the allowed list
  return allowed.some((pattern) => matchesTool(toolName, pattern))
}

/**
 * Filter tool definitions by a policy
 *
 * @param tools - All registered tool definitions
 * @param policy - The policy to apply
 * @returns Tool definitions that pass the policy filter
 */
export function filterToolsByPolicy(tools: ToolDefinition[], policy: ToolPolicy): ToolDefinition[] {
  return tools.filter((tool) => isToolAllowed(tool.name, policy))
}

/**
 * Merge two policies, with the second taking precedence
 */
export function mergePolicies(base: ToolPolicy, override: ToolPolicy): ToolPolicy {
  return {
    profile: override.profile ?? base.profile,
    allow: override.allow ?? base.allow,
    alsoAllow: [...(base.alsoAllow ?? []), ...(override.alsoAllow ?? [])],
    deny: [...(base.deny ?? []), ...(override.deny ?? [])],
  }
}
