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

/** Generate a unique execution ID — used to group all step messages from one subagent invocation */
const generateExecutionId = () => `exec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * A specialized agent that runs in its own isolated execute() loop.
 *
 * The orchestrator-worker pattern: the orchestrator (conversation handler) owns
 * the user-facing conversation. Subagents run in "worker" mode — they get their
 * own context window, can't see the conversation transcript, and can't send
 * messages to the user. They do their work autonomously and return structured
 * results via SubAgentExit.
 *
 * Why worker mode instead of letting subagents talk to the user directly?
 * It keeps the orchestrator in control of the conversation — subagents can't
 * leak implementation details, contradict each other, or confuse the user
 * with multiple voices. The orchestrator synthesizes results into one coherent
 * response.
 *
 * The dependency injection pattern (asTool receives execute + step) exists
 * because subagents need the conversation's execute() to run their own AI loop,
 * but they're defined as standalone modules. Passing execute at call time
 * avoids coupling subagent definitions to a specific conversation context.
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
 *   tools: [hrAgent.asTool(execute, step)],
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
   * Runs the subagent in an isolated execute() loop with worker mode.
   *
   * The flow: emit a "start" step → run execute() with the agent's instructions,
   * tools, and knowledge → capture traces (thinking, tool calls) as step messages
   * for the UI → extract the result from SubAgentExit → emit an "end" step.
   *
   * If the agent hits the iteration limit without exiting, we return a fallback
   * with needsInput=true so the orchestrator can ask the user for clarification
   * rather than silently failing.
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

    // Shared fields for all step messages — frontend groups by executionId
    const base = { executionId, agent: agentName, task };

    try {
      const taskPreview = task.length > 50 ? task.slice(0, 50) + "..." : task;
      step(`⏳ ${agentName.toUpperCase()} → "${taskPreview}"`, { ...base, type: "start" });

      // Flatten context object into a string the AI can read in its instructions
      const contextStr = input.context
        ? Object.entries(input.context)
            .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
            .join("\n")
        : "No additional context provided.";

      // mode: "worker" — the subagent runs autonomously in its own context.
      // It can't see the conversation transcript or send messages to the user.
      // It must exit via SubAgentExit to return results to the orchestrator.
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
          // onTrace fires synchronously during execute() — used here to stream
          // real-time UI updates as the subagent thinks and calls tools.
          onTrace: ({ trace }) => {
            // "comment" traces = the AI's internal reasoning (code comments in llmz)
            if (trace.type === "comment") {
              stepCount++;
              step(`💭 ${trace.comment}`, { ...base, type: "thinking" });
            }
            // ThinkSignal traces — thrown from tool handlers to give the AI instructions
            if (trace.type === "think_signal") {
              stepCount++;
              step(`🤔 thinking...`, { ...base, type: "thinking" });
            }
            // Tool call traces — show what tool was called and its result (truncated)
            if (trace.type === "tool_call") {
              stepCount++;
              step(`🔧 ${trace.tool_name}(${truncate(trace.input)}) → ${truncate(trace.output)}`, { ...base, type: "tool" });
            }
          },
        },
      });

      // result.is(SubAgentExit) checks if the AI used the "done" exit
      let output: SubAgentOutput;
      if (result.is(SubAgentExit)) {
        output = result.output;
      } else {
        // Hit iteration limit without exiting — treat as incomplete rather than failed
        output = {
          success: false,
          result: "The subagent could not complete the task within the iteration limit",
          needsInput: true,
          questions: ["Could you provide more details about what you need?"],
        };
      }

      const icon = output.needsInput ? "⚠️" : output.success ? "✅" : "❌";
      step(`${icon} ${agentName.toUpperCase()} → Done`, { ...base, type: "end", stepCount });

      return output;
    } catch (error: any) {
      step(`❌ ${agentName.toUpperCase()} → Failed: ${error?.message || "Unknown error"}`, { ...base, type: "end", stepCount });

      return {
        success: false,
        result: `Error occurred: ${error?.message || "Unknown error"}`,
        needsInput: false,
      };
    }
  }

  /** Binds execute and step so the tool handler only needs the input schema */
  private createRunner(
    execute: Autonomous.ConvoExecuteFn,
    step: StepFn
  ): (input: { task: string; context?: Record<string, any> }) => Promise<SubAgentOutput> {
    return (input) => this.run(input, execute, step);
  }

  /**
   * Wraps this subagent as an Autonomous.Tool the orchestrator can call.
   *
   * The dependency injection happens here: execute and step come from the
   * conversation handler, not from the SubAgent definition. This lets you
   * define agents as standalone modules (in src/agents/) and wire them up
   * at call time in the orchestrator:
   *
   *   tools: [hrAgent.asTool(execute, step)]
   *
   * The resulting tool name is `{name}_agent` (e.g., "hr_agent") and its
   * I/O schemas are SubAgentInputSchema / SubAgentOutputSchema — shared
   * across all subagents so the orchestrator treats them uniformly.
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
