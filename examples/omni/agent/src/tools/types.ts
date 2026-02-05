import type { Autonomous } from '@botpress/runtime'

/**
 * Context passed to tool factories for dependency injection
 */
export type ToolContext = {
  /** ID of the agent using this tool */
  agentId: string
  /** Optional session key for stateful operations */
  sessionKey?: string
  /** Configuration values from the agent config */
  config: {
    localPlaneUrl?: string
    localPlaneToken?: string
    workspacePath?: string
    soulMdPath?: string
    agentsMdPath?: string
  }
}

/**
 * Factory function that creates an Autonomous.Tool instance
 */
export type ToolFactory = (ctx: ToolContext) => Autonomous.Tool

/**
 * Tool definition for registration in the registry
 */
export type ToolDefinition = {
  /** Unique tool name (used in policies) */
  name: string
  /** Factory function to create the tool instance */
  factory: ToolFactory
  /** Groups this tool belongs to (e.g., ['local', 'filesystem']) */
  groups?: string[]
  /** Human-readable description for documentation */
  description?: string
}

/**
 * Tool policy for filtering which tools an agent can access
 */
export type ToolPolicy = {
  /** Preset profile: 'minimal', 'coding', 'full' */
  profile?: 'minimal' | 'coding' | 'full'
  /** Explicit allow list (tool names or 'group:xxx') */
  allow?: string[]
  /** Additional tools to allow (additive to profile/allow) */
  alsoAllow?: string[]
  /** Tools to deny (takes precedence over allow) */
  deny?: string[]
}
