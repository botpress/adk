/**
 * @types SubAgent Type System
 * @pattern Structured Input/Output Contract Between Orchestrator and Workers
 *
 * WHY THESE TYPES EXIST:
 * The orchestrator-worker pattern requires a well-defined contract: the orchestrator must
 * know what to send to each subagent (SubAgentInput) and what to expect back (SubAgentOutput).
 * These schemas are shared between the orchestrator (which provides them to the LLM as tool
 * schemas) and the subagent (which uses SubAgentExit to return structured results).
 *
 * WHY SubAgentOutputSchema HAS needsInput + questions:
 * Subagents run in worker mode (no user interaction). When a subagent needs information it
 * doesn't have (e.g., employee ID for vacation booking), it can't ask the user directly.
 * Instead, it sets needsInput=true and provides questions. The orchestrator sees this
 * structured output and asks the user those questions, then calls the subagent again with
 * the answers in the context field. This creates a clean feedback loop without breaking the
 * worker isolation boundary.
 *
 * WHY SubAgentExit (not just returning from handler):
 * Worker-mode execute() loops run until the LLM triggers an Exit. Exits are Autonomous.Exit
 * objects with typed schemas — the LLM must provide all required fields (success, result,
 * etc.) to complete the exit. This ensures the orchestrator always receives well-structured
 * data, even when the subagent fails.
 */
import { z, Knowledge, Autonomous } from "@botpress/runtime";

/**
 * Configuration for defining a SubAgent.
 * Each config defines a specialist: its name (used as tool name), description (used by
 * orchestrator LLM for routing), instructions (system prompt for the subagent's LLM),
 * and the tools/knowledge available to it.
 */
export type SubAgentConfig = {
  /** Unique identifier for the subagent */
  name: string;

  /** Description of what this subagent does - used by orchestrator to decide when to invoke */
  description: string;

  /** System prompt / instructions for the subagent */
  instructions: string;

  /** Tools available to this subagent */
  tools?: Autonomous.Tool[];

  /** Knowledge sources available to this subagent */
  knowledge?: Knowledge[];

  /** Maximum iterations before forcing exit (default: 10) */
  maxIterations?: number;
};

/**
 * Input schema for invoking a subagent
 */
export const SubAgentInputSchema = z.object({
  task: z.string().describe("The task to delegate to this subagent"),
  context: z.record(z.any()).optional().describe("Additional context to pass to the subagent"),
});

export type SubAgentInput = z.infer<typeof SubAgentInputSchema>;

/**
 * Output schema returned by all subagents
 */
export const SubAgentOutputSchema = z.object({
  success: z.boolean().describe("Whether the task was completed successfully"),
  result: z.string().describe("Summary of what was accomplished or found"),
  data: z.any().optional().describe("Structured data returned by the subagent"),
  needsInput: z.boolean().optional().describe("Whether more information is needed from the user"),
  questions: z.array(z.string()).optional().describe("Questions to ask the user if more info needed"),
});

export type SubAgentOutput = z.infer<typeof SubAgentOutputSchema>;

// ============================================
// SubAgent UI Types
// ============================================

/** Data passed with each step message */
export type StepData = {
  type: "start" | "thinking" | "tool" | "end";
  executionId: string;
  agent: string;
  task: string;
  stepCount?: number; // Only for "end"
};

/** Type for the step function passed via context */
export type StepFn = (msg: string, data: StepData) => void;

/**
 * Exit used by subagents to complete their work
 */
export const SubAgentExit = new Autonomous.Exit({
  name: "done",
  description: "Use this when you have completed the task or need to return results to the orchestrator",
  schema: SubAgentOutputSchema,
});
