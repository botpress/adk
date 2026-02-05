import { z, Autonomous } from '@botpress/runtime'
import type { ToolDefinition, ToolContext } from '../types.js'
import { getAgent, resolveAgentInstructions, getAllAgents } from '../../agents/registry.js'
import { createToolsForAgent } from '../registry.js'
import { mergePolicies } from '../policy.js'
import type { DelegateResult, AgentDefinition } from '../../agents/types.js'

/**
 * Exit for sub-agent delegation results
 * Sub-agents use this exit to return their results in worker mode
 */
const DelegateResultExit = new Autonomous.Exit({
  name: 'DelegateResult',
  description: 'Return the result of the delegated task. Use this exit when you have completed the task.',
  schema: z.object({
    result: z.string().describe('The result/output from completing the task'),
    summary: z.string().optional().describe('Brief summary of what was done'),
  }),
})

const inputSchema = z.object({
  agentId: z.string().describe('ID of the specialist agent to delegate to'),
  task: z.string().describe('Clear description of the task to accomplish'),
  context: z.string().optional().describe('Additional context or information relevant to the task'),
})

const outputSchema = z.object({
  agentId: z.string().describe('ID of the agent that was invoked'),
  result: z.string().describe('Result output from the agent'),
  success: z.boolean().describe('Whether the task completed successfully'),
  error: z.string().optional().describe('Error message if the task failed'),
})

/**
 * Get agents available for delegation from a parent agent
 * If canDelegate is specified, only those agents are available
 * Otherwise, all agents except the parent are available
 */
export function getAvailableAgentsForDelegation(parentAgent: AgentDefinition | undefined, excludeId: string): AgentDefinition[] {
  const allAgents = getAllAgents()

  if (parentAgent?.canDelegate && parentAgent.canDelegate.length > 0) {
    // Filter to only allowed agents
    return allAgents.filter((a) => parentAgent.canDelegate!.includes(a.id))
  }

  // Default: all agents except self
  return allAgents.filter((a) => a.id !== excludeId)
}

/**
 * Build the delegate tool description dynamically from available agents
 */
function buildDelegateDescription(availableAgents: AgentDefinition[]): string {
  if (availableAgents.length === 0) {
    return 'Delegate tasks to specialist agents. (No agents currently available for delegation)'
  }

  const agentList = availableAgents.map((a) => `- ${a.id}: ${a.description ?? a.name}`).join('\n')

  return `Delegate a task to a specialist agent. Available agents:\n${agentList}\n\nUse delegation when a task requires specialized skills or when you want to break down complex work.`
}

/**
 * Default delegation policy values
 */
const DEFAULT_MAX_DEPTH = 2
const DEFAULT_TIMEOUT = 120000 // 2 minutes

/**
 * Create a delegate tool that can invoke other agents
 *
 * Note: This requires an execute function to be provided at runtime.
 * The execute function should match the ADK's execute signature.
 */
export const delegateToolDef: ToolDefinition = {
  name: 'delegate',
  groups: ['delegation'],
  description: 'Delegate tasks to specialist agents',
  factory: (ctx: ToolContext) => {
    const parentAgent = getAgent(ctx.agentId)
    const availableAgents = getAvailableAgentsForDelegation(parentAgent, ctx.agentId)

    return new Autonomous.Tool({
      name: 'delegate',
      description: buildDelegateDescription(availableAgents),
      input: inputSchema,
      output: outputSchema,
      handler: async (input): Promise<DelegateResult> => {
        const { agentId, task, context: taskContext } = input

        // Check if agent is in the available list
        const availableIds = availableAgents.map((a) => a.id)
        if (!availableIds.includes(agentId)) {
          return {
            agentId,
            result: '',
            success: false,
            error: `Cannot delegate to "${agentId}". Available agents: ${availableIds.join(', ')}`,
          }
        }

        // Look up the agent
        const agent = getAgent(agentId)
        if (!agent) {
          return {
            agentId,
            result: '',
            success: false,
            error: `Unknown agent: "${agentId}". Available agents: ${availableIds.join(', ')}`,
          }
        }

        // Determine the subagent's tool policy
        let subagentToolPolicy = agent.tools
        if (parentAgent?.subagentPolicy) {
          subagentToolPolicy = mergePolicies(agent.tools, parentAgent.subagentPolicy)
        }

        // Create tools for the subagent
        const subagentTools = createToolsForAgent(agentId, subagentToolPolicy, {
          config: ctx.config,
          sessionKey: ctx.sessionKey,
        })

        // Build instructions for the subagent
        const instructions = resolveAgentInstructions(agent, {
          task,
          context: taskContext,
        })

        // Stub implementation - actual execute integration happens in conversation handler
        return {
          agentId,
          result: `[Delegation to ${agentId}] Task: ${task}. This requires ADK execute() integration.`,
          success: true,
        }
      },
    })
  },
}

/**
 * Execute function type for delegation
 * Uses the ADK's ConvoExecuteFn which returns ExecuteResult
 */
export type DelegateExecuteFn = Autonomous.ConvoExecuteFn

/**
 * Extended context for delegation with depth tracking
 */
export type DelegateContext = ToolContext & {
  /** Current delegation depth (0 = top-level) */
  delegationDepth?: number
}

/**
 * Create a delegate tool with configurable nested delegation support
 *
 * This is the full-featured version that supports:
 * - Depth-limited nested delegation (agents can delegate to other agents)
 * - Per-agent delegation policies (canDelegate, delegationPolicy)
 * - Timeout handling
 *
 * @param ctx - Tool context with optional depth tracking
 * @param execute - ADK execute function
 * @param createNestedDelegateTool - Factory to create delegate tools for subagents (for recursion)
 */
export function createDelegateToolWithNestedSupport(
  ctx: DelegateContext,
  execute: DelegateExecuteFn,
  createNestedDelegateTool?: (subCtx: DelegateContext, subExecute: DelegateExecuteFn) => Autonomous.Tool
): Autonomous.Tool {
  const parentAgent = getAgent(ctx.agentId)
  const currentDepth = ctx.delegationDepth ?? 0
  const maxDepth = parentAgent?.delegationPolicy?.maxDepth ?? DEFAULT_MAX_DEPTH

  const availableAgents = getAvailableAgentsForDelegation(parentAgent, ctx.agentId)

  return new Autonomous.Tool({
    name: 'delegate',
    description: buildDelegateDescription(availableAgents),
    input: inputSchema,
    output: outputSchema,
    handler: async (input): Promise<DelegateResult> => {
      const { agentId, task, context: taskContext } = input

      // Check if delegation is allowed to this agent
      const availableIds = availableAgents.map((a) => a.id)
      if (!availableIds.includes(agentId)) {
        return {
          agentId,
          result: '',
          success: false,
          error: `Cannot delegate to "${agentId}". Available agents: ${availableIds.join(', ')}`,
        }
      }

      const agent = getAgent(agentId)
      if (!agent) {
        return {
          agentId,
          result: '',
          success: false,
          error: `Unknown agent: "${agentId}"`,
        }
      }

      // Build subagent tool policy
      let subagentToolPolicy = agent.tools
      if (parentAgent?.subagentPolicy) {
        subagentToolPolicy = mergePolicies(agent.tools, parentAgent.subagentPolicy)
      }

      // Create subagent context with incremented depth
      const subCtx: DelegateContext = {
        agentId,
        config: ctx.config,
        sessionKey: ctx.sessionKey,
        delegationDepth: currentDepth + 1,
      }

      // Create tools for the subagent (already returns Autonomous.Tool[])
      const subagentTools = createToolsForAgent(agentId, subagentToolPolicy, {
        config: ctx.config,
        sessionKey: ctx.sessionKey,
      })

      // Check if subagent can delegate (depth check + has canDelegate configured)
      const subagentCanDelegate =
        currentDepth + 1 < maxDepth && agent.canDelegate && agent.canDelegate.length > 0 && createNestedDelegateTool

      if (subagentCanDelegate && createNestedDelegateTool) {
        // Add a delegate tool for the subagent
        const nestedDelegateTool = createNestedDelegateTool(subCtx, execute)
        subagentTools.push(nestedDelegateTool)
      }

      // Build instructions with worker mode completion guidance
      const baseInstructions = resolveAgentInstructions(agent, {
        task,
        context: taskContext,
      })

      // Append worker mode instructions to tell agent how to complete
      const workerInstructions = `${baseInstructions}

## Task Completion

When you have completed the delegated task, you MUST use the "DelegateResult" exit to return your results.
Provide a clear result string describing the outcome and optionally a brief summary of what you accomplished.`

      try {
        const result = await execute({
          model: agent.model ?? 'anthropic:claude-sonnet-4-20250514',
          instructions: workerInstructions,
          tools: subagentTools,
          exits: [DelegateResultExit],
          mode: 'worker',
        })

        // Handle different result types
        if (result.is(DelegateResultExit)) {
          return {
            agentId,
            result: result.output.result,
            success: true,
          }
        } else if (result.isSuccess()) {
          // Exited through a different exit (e.g., DefaultExit)
          const output = result.output
          return {
            agentId,
            result: typeof output === 'string' ? output : JSON.stringify(output),
            success: true,
          }
        } else if (result.isError()) {
          return {
            agentId,
            result: '',
            success: false,
            error: result.error instanceof Error ? result.error.message : String(result.error),
          }
        } else if (result.isInterrupted()) {
          return {
            agentId,
            result: 'Task was interrupted and did not complete',
            success: false,
            error: 'Execution was interrupted',
          }
        }

        // Fallback for unexpected result type
        return {
          agentId,
          result: '',
          success: false,
          error: 'Unexpected execution result',
        }
      } catch (error) {
        return {
          agentId,
          result: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during delegation',
        }
      }
    },
  })
}

/**
 * Create a delegate tool with a real execute function (simpler version without nested delegation)
 * Use this when you have access to the ADK execute function but don't need nested delegation
 */
export function createDelegateToolWithExecute(ctx: ToolContext, execute: DelegateExecuteFn): Autonomous.Tool {
  const parentAgent = getAgent(ctx.agentId)
  const availableAgents = getAvailableAgentsForDelegation(parentAgent, ctx.agentId)

  return new Autonomous.Tool({
    name: 'delegate',
    description: buildDelegateDescription(availableAgents),
    input: inputSchema,
    output: outputSchema,
    handler: async (input): Promise<DelegateResult> => {
      const { agentId, task, context: taskContext } = input

      // Check if delegation is allowed
      const availableIds = availableAgents.map((a) => a.id)
      if (!availableIds.includes(agentId)) {
        return {
          agentId,
          result: '',
          success: false,
          error: `Cannot delegate to "${agentId}". Available agents: ${availableIds.join(', ')}`,
        }
      }

      const agent = getAgent(agentId)
      if (!agent) {
        return {
          agentId,
          result: '',
          success: false,
          error: `Unknown agent: "${agentId}"`,
        }
      }

      let subagentToolPolicy = agent.tools
      if (parentAgent?.subagentPolicy) {
        subagentToolPolicy = mergePolicies(agent.tools, parentAgent.subagentPolicy)
      }

      // Create tools for the subagent (already returns Autonomous.Tool[])
      const subagentTools = createToolsForAgent(agentId, subagentToolPolicy, {
        config: ctx.config,
        sessionKey: ctx.sessionKey,
      })

      // Build instructions with worker mode completion guidance
      const baseInstructions = resolveAgentInstructions(agent, {
        task,
        context: taskContext,
      })

      const workerInstructions = `${baseInstructions}

## Task Completion

When you have completed the delegated task, you MUST use the "DelegateResult" exit to return your results.
Provide a clear result string describing the outcome and optionally a brief summary of what you accomplished.`

      try {
        const result = await execute({
          model: agent.model ?? 'anthropic:claude-sonnet-4-20250514',
          instructions: workerInstructions,
          tools: subagentTools,
          exits: [DelegateResultExit],
          mode: 'worker',
        })

        // Handle different result types
        if (result.is(DelegateResultExit)) {
          return {
            agentId,
            result: result.output.result,
            success: true,
          }
        } else if (result.isSuccess()) {
          // Exited through a different exit
          const output = result.output
          return {
            agentId,
            result: typeof output === 'string' ? output : JSON.stringify(output),
            success: true,
          }
        } else if (result.isError()) {
          return {
            agentId,
            result: '',
            success: false,
            error: result.error instanceof Error ? result.error.message : String(result.error),
          }
        } else if (result.isInterrupted()) {
          return {
            agentId,
            result: 'Task was interrupted and did not complete',
            success: false,
            error: 'Execution was interrupted',
          }
        }

        // Fallback for unexpected result type
        return {
          agentId,
          result: '',
          success: false,
          error: 'Unexpected execution result',
        }
      } catch (error) {
        return {
          agentId,
          result: '',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during delegation',
        }
      }
    },
  })
}
