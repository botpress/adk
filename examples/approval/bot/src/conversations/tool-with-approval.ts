import { Autonomous, context, z } from "@botpress/runtime";

/**
 * @class ToolWithApproval
 * @pattern Error-Driven Approval Gate (extends Autonomous.Tool)
 *
 * WHY THIS APPROACH (error-throwing instead of a separate approval tool):
 * The approval mechanism works by exploiting the LLM's error-recovery loop. When the
 * tool throws an error saying "requires approval", the LLM naturally responds by asking
 * the user for confirmation. This is more elegant than a separate "request_approval" tool
 * because:
 * 1. No extra tool definition needed — any tool can become approval-gated
 * 2. The LLM's built-in error handling drives the UX naturally
 * 3. The approval state is invisible to the LLM — it just retries the same tool call
 *
 * HOW THE STATE MACHINE WORKS:
 * State transitions for a single tool call:
 *
 *   [No approval] --LLM calls tool--> [Pending approval created, error thrown]
 *       |                                        |
 *       |                              [LLM asks user to approve]
 *       |                                        |
 *       |                              [User sends new message]
 *       |                                        |
 *       v                              [LLM retries same tool call]
 *   [Tool executes]  <----match found + new user message----+
 *       |
 *   [Approval record cleaned up]
 *
 * WHY DEEP EQUALITY CHECK (not approval IDs):
 * Approvals are matched by comparing the tool name + full input object via deep equality.
 * This was chosen over unique approval IDs because the LLM doesn't need to track IDs —
 * it simply retries the exact same tool call. This keeps the LLM prompt clean and reduces
 * the chance of the LLM fabricating or misremembering an approval ID.
 *
 * WHY lastUserMessageId CHECK:
 * When the LLM retries a tool call, we verify that the user has sent a NEW message since
 * the approval was created. This prevents auto-approval: without this check, the LLM could
 * call the tool, get the error, immediately retry, and auto-approve itself. The message ID
 * check guarantees a real human interaction happened between attempts.
 *
 * WHY .slice(-10) ON PENDING APPROVALS:
 * The pending approvals array is capped at 10 entries to prevent unbounded state growth.
 * In practice, there should only be 1-2 pending approvals at a time, but the cap prevents
 * edge cases where the LLM repeatedly proposes different inputs without user response.
 *
 * WHY structuredClone:
 * The input object is deep-cloned before storing in state to prevent reference sharing
 * between the approval record and the LLM's working memory. Without cloning, mutations
 * to the input object could silently break the deep equality check on retry.
 */
export class ToolWithApproval extends Autonomous.Tool {
  private state: {
    pendingApprovals: z.infer<
      typeof ToolWithApproval.ApprovalState.pendingApprovals
    >;
  };

  constructor(
    props: ConstructorParameters<typeof Autonomous.Tool>[0] & {
      state: {
        pendingApprovals: z.infer<
          typeof ToolWithApproval.ApprovalState.pendingApprovals
        >;
      };
    }
  ) {
    super({
      ...props,
      description:
        props.description +
        `\n\n**Note:** This tool handles user approvals automatically. Just call the tool as usual, and it will throw an error if approval is needed.`,
    });
    this.state = props.state;
  }

  async execute(input: any, ctx: { callId: string }) {
    this.state.pendingApprovals ??= [];

    const transcript = await context.get("chat").fetchTranscript();

    const deepEqual = (a: any, b: any): boolean => {
      if (a === b) return true;
      if (a === null || b === null) return false;
      if (typeof a !== typeof b) return false;
      if (typeof a !== "object") return false;
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;
      return keysA.every((key) => deepEqual(a[key], b[key]));
    };

    const match = this.state.pendingApprovals.find(
      (x) => x.toolName === this.name && deepEqual(x.input, input)
    );

    const lastUserMessageId =
      transcript.findLast((x) => x.role === "user")?.id ?? null;

    // Approval already pending
    if (match) {
      // Make sure that the user has sent a new message since the last time
      // This ensures that the user has had a chance to approve the tool call and we didn't auto-approve it
      if (match.lastUserMessageId === lastUserMessageId) {
        throw new Error(
          `Tool "${this.name}" is still pending user approval. Please ask the user to approve before proceeding.`
        );
      }

      try {
        return super.execute(input, ctx);
      } finally {
        this.state.pendingApprovals = this.state.pendingApprovals.filter(
          (x) => !(x.toolName === this.name && deepEqual(x.input, input))
        );
      }
    }

    this.state.pendingApprovals = [
      ...this.state.pendingApprovals.slice(-10),
      structuredClone({
        toolName: this.name,
        input,
        lastUserMessageId,
      }),
    ];

    throw new Error(
      `Tool "${this.name}" requires approval before execution. Please ask the user to approve before proceeding then retry calling the tool with the same input.`
    );
  }

  static ApprovalState = z.object({
    pendingApprovals: z.array(
      z.object({
        lastUserMessageId: z.string().nullable(),
        toolName: z.string(),
        input: z.any(),
      })
    ),
  }).shape;
}
