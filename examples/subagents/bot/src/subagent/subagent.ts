import { Autonomous } from "@botpress/runtime";
import {
  type SubAgentConfig,
  type SubAgentOutput,
  type StepFn,
  SubAgentInputSchema,
  SubAgentOutputSchema,
  SubAgentExit,
} from "./types";
import { truncate } from "../utils/truncate";

/** Generate a unique execution ID */
const generateExecutionId = () => `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;


/**
 * SubAgent - A specialized agent that runs in its own context
 *
 * Inspired by Claude Code's subagent pattern:
 * - Each subagent has its own context window (separate execute() loop)
 * - Returns structured results, not full conversation
 * - Cannot spawn other subagents (no nesting)
 * - Main orchestrator synthesizes results and talks to user
 *
 * @example
 * ```typescript
 * const hrAgent = new SubAgent({
 *   name: "hr",
 *   description: "Handles HR tasks like vacation booking and benefits",
 *   instructions: "You are an HR specialist...",
 *   tools: [bookVacation, getBenefits],
 * });
 *
 * // Use in orchestrator
 * await execute({
 *   instructions: "You are a helpful assistant...",
 *   tools: [hrAgent.asTool()],
 * });
 * ```
 */
export class SubAgent {
  private config: SubAgentConfig;

  constructor(config: SubAgentConfig) {
    this.config = {
      ...config,
      maxIterations: config.maxIterations ?? 10,
    };
  }

  /** Get the subagent's name */
  get name(): string {
    return this.config.name;
  }

  /** Get the subagent's description */
  get description(): string {
    return this.config.description;
  }

  /**
   * Execute the subagent with a given task
   * Runs in Worker Mode (autonomous loop until exit)
   */
  async run(
    input: { task: string; context?: Record<string, any> },
    execute: Autonomous.ConvoExecuteFn,
    step: StepFn
  ): Promise<SubAgentOutput> {
    const executionId = generateExecutionId();
    const agentName = this.config.name;
    const task = input.task;
    let stepCount = 0;

    // Base data for all steps
    const base = { executionId, agent: agentName, task };

    try {
      // Send START step
      const taskPreview = task.length > 50 ? task.slice(0, 50) + "..." : task;
      step(`⏳ ${agentName.toUpperCase()} → "${taskPreview}"`, { ...base, type: "start" });

      // Build context string from provided context
      const contextStr = input.context
        ? Object.entries(input.context)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join("\n")
        : "No additional context provided.";

      // Run the subagent in Worker Mode (no yielding, autonomous until exit)
      const result = await execute({
        mode: "worker",
        instructions: `${this.config.instructions}

## Your Task
${input.task}

## Context
${contextStr}

## How to Complete
1. Use your available tools to accomplish the task
2. When finished, return via the "done" exit with your results
3. If you need more information from the user, set needsInput=true and provide questions

## Return Format
\`\`\`typescript
return {
  action: 'done',
  success: true,           // false if task failed
  result: 'Summary here',  // what was accomplished
  data: { ... },           // optional structured data
  needsInput: false,       // true if you need more info
  questions: []            // questions to ask if needsInput
}
\`\`\``,
        tools: this.config.tools,
        knowledge: this.config.knowledge,
        exits: [SubAgentExit],
        iterations: this.config.maxIterations,
        hooks: {
          // onTrace is NON-BLOCKING (sync)
          onTrace: ({ trace }) => {
            // Capture agent's thinking (comments in generated code)
            if (trace.type === "comment") {
              stepCount++;
              step(`💭 ${trace.comment}`, { ...base, type: "thinking" });
            }
            // Capture explicit think signals
            if (trace.type === "think_signal") {
              stepCount++;
              step(`🤔 thinking...`, { ...base, type: "thinking" });
            }
            // Capture tool calls
            if (trace.type === "tool_call") {
              stepCount++;
              step(`🔧 ${trace.tool_name}(${truncate(trace.input)}) → ${truncate(trace.output)}`, { ...base, type: "tool" });
            }
          },
        },
      });

      // Extract result from exit
      let output: SubAgentOutput;
      if (result.is(SubAgentExit)) {
        output = result.output;
      } else {
        // Fallback if no exit was triggered
        output = {
          success: false,
          result: "The subagent could not complete the task within the iteration limit",
          needsInput: true,
          questions: ["Could you provide more details about what you need?"],
        };
      }

      // Determine status icon
      const icon = output.needsInput ? "⚠️" : output.success ? "✅" : "❌";

      // Send END step
      step(`${icon} ${agentName.toUpperCase()} → Done`, { ...base, type: "end", stepCount });

      return output;
    } catch (error: any) {
      // Send END step with error
      step(`❌ ${agentName.toUpperCase()} → Failed: ${error?.message || "Unknown error"}`, { ...base, type: "end", stepCount });

      return {
        success: false,
        result: `Error occurred: ${error?.message || "Unknown error"}`,
        needsInput: false,
      };
    }
  }

  /**
   * Creates a runner function with execute and step bound
   */
  private createRunner(
    execute: Autonomous.ConvoExecuteFn,
    step: StepFn
  ): (input: { task: string; context?: Record<string, any> }) => Promise<SubAgentOutput> {
    return (input) => this.run(input, execute, step);
  }

  /**
   * Convert this subagent to an Autonomous.Tool for use in orchestrator
   * Accepts execute and step functions via dependency injection
   */
  asTool(execute: Autonomous.ConvoExecuteFn, step: StepFn): Autonomous.Tool {
    const runner = this.createRunner(execute, step);

    return new Autonomous.Tool({
      name: `${this.config.name}_agent`,
      description: this.config.description,
      input: SubAgentInputSchema,
      output: SubAgentOutputSchema,
      handler: runner,
    });
  }
}
