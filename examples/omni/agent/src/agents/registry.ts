import type { AgentDefinition, AgentContext } from './types.js'

/**
 * Global registry of agent definitions
 */
const agentDefinitions: Map<string, AgentDefinition> = new Map()

/**
 * Register an agent definition in the global registry
 *
 * @param def - The agent definition to register
 * @throws Error if an agent with the same ID is already registered
 */
export function registerAgent(def: AgentDefinition): void {
  if (agentDefinitions.has(def.id)) {
    throw new Error(`Agent "${def.id}" is already registered`)
  }
  agentDefinitions.set(def.id, def)
}

/**
 * Get a registered agent definition by ID
 */
export function getAgent(id: string): AgentDefinition | undefined {
  return agentDefinitions.get(id)
}

/**
 * Get all registered agent definitions
 */
export function getAllAgents(): AgentDefinition[] {
  return Array.from(agentDefinitions.values())
}

/**
 * List all registered agent IDs
 */
export function listAgentIds(): string[] {
  return Array.from(agentDefinitions.keys())
}

/**
 * List agents as a formatted string for tool descriptions
 */
export function listAgentsForToolDescription(): string {
  return getAllAgents()
    .map((agent) => `- ${agent.id}: ${agent.description ?? agent.name}`)
    .join('\n')
}

/**
 * Check if an agent is registered
 */
export function hasAgentRegistered(id: string): boolean {
  return agentDefinitions.has(id)
}

/**
 * Unregister an agent (mainly for testing)
 */
export function unregisterAgent(id: string): boolean {
  return agentDefinitions.delete(id)
}

/**
 * Clear all registered agents (mainly for testing)
 */
export function clearAgentRegistry(): void {
  agentDefinitions.clear()
}

/**
 * Resolve agent instructions (handle static string vs dynamic builder)
 */
export function resolveAgentInstructions(agent: AgentDefinition, ctx: AgentContext): string {
  if (typeof agent.instructions === 'function') {
    return agent.instructions(ctx)
  }
  return agent.instructions
}

/**
 * Get agents filtered by tags
 */
export function getAgentsByTag(tag: string): AgentDefinition[] {
  return getAllAgents().filter((agent) => agent.tags?.includes(tag))
}

/**
 * Create a summary of the agent registry for debugging
 */
export function getRegistrySummary(): {
  totalAgents: number
  agents: Array<{ id: string; name: string; description?: string }>
} {
  const allAgents = getAllAgents()

  return {
    totalAgents: allAgents.length,
    agents: allAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      description: agent.description,
    })),
  }
}
