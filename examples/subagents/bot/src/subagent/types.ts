import { z, Knowledge, Autonomous } from "@botpress/runtime";

/**
 * Configuration for defining a SubAgent
 * Similar to Claude Code's markdown files with YAML frontmatter
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
