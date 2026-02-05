import type { ToolPolicy } from '../tools/types.js'

/**
 * Context available when building agent instructions
 */
export type AgentContext = {
  /** The task being delegated (for subagents) */
  task?: string
  /** Additional context provided by the delegating agent */
  context?: string
  /** Bot state (for main agent) */
  botState?: Record<string, unknown>
  /** Loaded context files (SOUL.md, AGENTS.md, etc.) */
  loadedContext?: {
    soul?: string
    agents?: string
    memory?: string
  }
}

/**
 * Delegation policy for controlling nested agent calls
 */
export type DelegationPolicy = {
  /** Maximum delegation chain depth (default: 2) */
  maxDepth?: number
  /** Timeout for delegated tasks in milliseconds */
  timeout?: number
}

/**
 * Agent definition for registration in the registry
 */
export type AgentDefinition = {
  /** Unique agent identifier */
  id: string
  /** Human-readable display name */
  name: string
  /** Agent instructions (static string or dynamic builder) */
  instructions: string | ((ctx: AgentContext) => string)
  /** Tool policy defining which tools this agent can use */
  tools: ToolPolicy
  /** Model override (defaults to claude-sonnet) */
  model?: string
  /** Policy applied to nested execute() calls (for subagents created by this agent) */
  subagentPolicy?: ToolPolicy
  /** Optional description for the delegate tool listing */
  description?: string
  /** Tags for categorization */
  tags?: string[]
  /** Agent IDs this agent can delegate to (undefined = all agents except self) */
  canDelegate?: string[]
  /** Policy for delegation behavior (depth limits, timeouts) */
  delegationPolicy?: DelegationPolicy
}

/**
 * Result from a delegated agent execution
 */
export type DelegateResult = {
  /** The agent that was invoked */
  agentId: string
  /** The result output from the agent */
  result: string
  /** Whether the task completed successfully */
  success: boolean
  /** Error message if failed */
  error?: string
}

// Re-export ToolPolicy for convenience
export type { ToolPolicy } from '../tools/types.js'
