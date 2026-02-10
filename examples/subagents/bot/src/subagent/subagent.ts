/**
 * @class SubAgent
 * @pattern Tool-Wrapper Around Isolated Worker-Mode execute() Calls
 *
 * WHY THIS CLASS EXISTS:
 * SubAgent is the bridge between the orchestrator pattern and ADK's execute() system.
 * It wraps a full execute() call (with its own instructions, tools, and knowledge) into an
 * Autonomous.Tool that the orchestrator can invoke like any other tool. This is the core
 * abstraction that enables multi-agent architectures in ADK.
 *
 * HOW IT WORKS INTERNALLY:
 * 1. Orchestrator LLM calls hr_agent tool with { task: "book vacation", context: {...} }
 * 2. asTool() delegates to run(), which calls execute() in worker mode
 * 3. Worker-mode execute() creates a NEW, ISOLATED LLM context:
 *    - Its own system prompt (this.config.instructions + task + context)
 *    - Its own tools (this.config.tools — only HR tools, not other subagent tools)
 *    - Its own knowledge (this.config.knowledge — only HR docs)
 *    - Its own iteration limit (this.config.maxIterations)
 * 4. The worker LLM runs autonomously until it triggers SubAgentExit
 * 5. The structured output flows back to the orchestrator
 *
 * WHY worker MODE (not default conversation mode):
 * Default mode allows the LLM to send messages to the user and wait for replies. Worker mode
 * disables this — the subagent can only use tools and return via exits. This prevents
 * subagents from talking to the user directly, which would break the orchestrator's control
 * over the conversation UX.
 *
 * WHY DEPENDENCY INJECTION (execute + step passed to asTool/run):
 * Each conversation has its own execute() function bound to its conversation context. The
 * orchestrator passes its execute to the subagent so the subagent's worker-mode execution
 * runs within the same conversation's context (same memory, same transcript awareness).
 * The step function is similarly injected so subagents can emit UI progress updates.
 *
 * WHY onTrace HOOK (not explicit step calls):
 * The subagent's LLM thinking and tool calls are captured via the onTrace hook and forwarded
 * to the step() function for UI display. This is non-invasive — the subagent doesn't need
 * to know about the step system. The orchestrator transparently observes the subagent's
 * internal execution.
 *
 * WHY maxIterations DEFAULTS TO 10:
 * This caps the subagent's autonomous loop to prevent runaway execution. Most subagent tasks
 * (check a balance, create a ticket) complete in 1-3 iterations. The cap prevents edge cases
 * where the LLM gets stuck in a reasoning loop without triggering the exit.
 *
 * WHY FALLBACK ON NO EXIT:
 * If the subagent exhausts its iterations without triggering SubAgentExit, the run() method
 * returns a fallback output with needsInput=true. This handles the edge case gracefully —
 * the orchestrator will ask the user for more details, which usually resolves the issue.
 */
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

/** Generate a unique execution ID for tracing/debugging subagent runs */
const generateExecutionId = () => `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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
