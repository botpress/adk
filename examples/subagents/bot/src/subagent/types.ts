import { z, Knowledge, Autonomous } from "@botpress/runtime";

/**
 * Configuration for defining a SubAgent.
 *
 * Each subagent is a self-contained specialist: it has its own instructions,
 * tools, and optional knowledge bases. The orchestrator never sees the
 * subagent's internals — it only sees the name and description (via asTool())
 * to decide when to delegate.
 */
export type SubAgentConfig = {
  /** Unique identifier — becomes the tool name as `{name}_agent` in the orchestrator */
  name: string;

  /** Description of what this subagent does — the orchestrator's AI reads this to decide when to invoke */
  description: string;

  /** System prompt / instructions for the subagent's isolated execute() loop */
  instructions: string;

  /** Tools available to this subagent — scoped to this agent only, not shared with the orchestrator */
  tools?: Autonomous.Tool[];

  /** Knowledge sources available to this subagent */
  knowledge?: Knowledge[];

  /** Maximum iterations before forcing exit (default: 10) */
  maxIterations?: number;
};

/**
 * Input schema for invoking a subagent. The orchestrator's AI fills these
 * fields when it calls the subagent tool — task is the natural language
 * request, context carries structured data from prior interactions
 * (e.g., an employee ID the user already provided).
 */
export const SubAgentInputSchema = z.object({
  task: z.string().describe("The task to delegate to this subagent"),
  context: z.record(z.any()).optional().describe("Additional context to pass to the subagent"),
});

export type SubAgentInput = z.infer<typeof SubAgentInputSchema>;

/**
 * Output schema returned by all subagents via the SubAgentExit.
 *
 * The needsInput/questions flow is the key multi-turn pattern: subagents
 * can't talk to the user directly (worker mode), so they signal that they
 * need more info. The orchestrator relays the questions to the user,
 * then calls the subagent again with the answers in context.
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

/**
 * Payload attached to each custom message sent during subagent execution.
 * The frontend groups these by executionId to build the SubAgentCard UI.
 *
 * Lifecycle: start → thinking/tool (0..n) → end
 */
export type StepData = {
  type: "start" | "thinking" | "tool" | "end";
  executionId: string;   // Groups all steps from one subagent invocation
  agent: string;
  task: string;
  stepCount?: number;    // Only on "end" — total steps taken
  // Note: the conversation handler adds `ts: Date.now()` when sending the
  // custom message. The frontend StepData type includes ts for sorting,
  // but it's not part of this type since it's added at the transport layer.
};

/**
 * Callback the orchestrator injects into subagent.run() to emit UI updates.
 * In webchat, each call sends a custom message the frontend renders.
 * In chat (CLI), it sends a plain text message instead.
 */
export type StepFn = (msg: string, data: StepData) => void;

/**
 * The single exit all subagents use to return results.
 *
 * Autonomous.Exit defines a named exit point for an execute() loop.
 * When the AI calls this exit, execute() returns an object you can
 * check with result.is(SubAgentExit) to extract the typed output.
 * Using one shared exit (instead of per-agent exits) keeps the
 * SubAgent framework generic — any specialist can return the same shape.
 */
export const SubAgentExit = new Autonomous.Exit({
  name: "done",
  description: "Use this when you have completed the task or need to return results to the orchestrator",
  schema: SubAgentOutputSchema,
});
