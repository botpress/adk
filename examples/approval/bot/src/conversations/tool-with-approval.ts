import { Autonomous, context, z } from "@botpress/runtime";

/**
 * A tool that requires user approval before execution.
 * When executed, if there is no pending approval for the given input,
 * it will throw an error indicating that approval is needed.
 *
 * This tool keeps track of pending approvals in the conversation state.
 * You need to extend the conversation state with `ToolWithApproval.ApprovalState` to use it.
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
