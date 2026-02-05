import type { Autonomous } from '@botpress/runtime'
import type { ToolDefinition, ToolContext, ToolPolicy } from './types.js'
import { filterToolsByPolicy } from './policy.js'

// Re-export groups and profiles for external use
export { TOOL_GROUPS, TOOL_PROFILES, expandGroups, isToolAllowed, filterToolsByPolicy } from './policy.js'

/**
 * Global registry of tool definitions
 */
const toolDefinitions: Map<string, ToolDefinition> = new Map()

/**
 * Register a tool definition in the global registry
 *
 * @param def - The tool definition to register
 * @throws Error if a tool with the same name is already registered
 */
export function registerTool(def: ToolDefinition): void {
  if (toolDefinitions.has(def.name)) {
    throw new Error(`Tool "${def.name}" is already registered`)
  }
  toolDefinitions.set(def.name, def)
}

/**
 * Get a registered tool definition by name
 */
export function getTool(name: string): ToolDefinition | undefined {
  return toolDefinitions.get(name)
}

/**
 * Get all registered tool definitions
 */
export function getAllTools(): ToolDefinition[] {
  return Array.from(toolDefinitions.values())
}

/**
 * List all registered tool names
 */
export function listToolNames(): string[] {
  return Array.from(toolDefinitions.keys())
}

/**
 * Check if a tool is registered
 */
export function hasToolRegistered(name: string): boolean {
  return toolDefinitions.has(name)
}

/**
 * Unregister a tool (mainly for testing)
 */
export function unregisterTool(name: string): boolean {
  return toolDefinitions.delete(name)
}

/**
 * Clear all registered tools (mainly for testing)
 */
export function clearToolRegistry(): void {
  toolDefinitions.clear()
}

/**
 * Create tool instances for an agent based on their policy
 *
 * This is the main entry point for getting tools for an agent.
 * It filters the registered tools by the agent's policy and
 * instantiates them with the provided context.
 *
 * @param agentId - The ID of the agent requesting tools
 * @param policy - The tool policy to apply
 * @param ctx - Context for tool instantiation
 * @returns Array of Autonomous.Tool instances
 */
export function createToolsForAgent(
  agentId: string,
  policy: ToolPolicy,
  ctx: Omit<ToolContext, 'agentId'>
): Autonomous.Tool[] {
  // Get all registered tools
  const allTools = getAllTools()

  // Filter by policy
  const allowedDefs = filterToolsByPolicy(allTools, policy)

  // Build context with agentId
  const toolContext: ToolContext = {
    ...ctx,
    agentId,
  }

  // Instantiate tools via their factories (factories return Autonomous.Tool)
  return allowedDefs.map((def) => def.factory(toolContext))
}

/**
 * Get tool definitions that belong to a specific group
 */
export function getToolsByGroup(group: string): ToolDefinition[] {
  const groupName = group.startsWith('group:') ? group : `group:${group}`
  return getAllTools().filter((tool) => tool.groups?.includes(groupName.replace('group:', '')))
}

/**
 * Create a summary of the tool registry for debugging
 */
export function getRegistrySummary(): {
  totalTools: number
  toolNames: string[]
  groupMemberships: Record<string, string[]>
} {
  const allTools = getAllTools()
  const groupMemberships: Record<string, string[]> = {}

  for (const tool of allTools) {
    if (tool.groups) {
      for (const group of tool.groups) {
        if (!groupMemberships[group]) {
          groupMemberships[group] = []
        }
        groupMemberships[group].push(tool.name)
      }
    }
  }

  return {
    totalTools: allTools.length,
    toolNames: listToolNames(),
    groupMemberships,
  }
}
