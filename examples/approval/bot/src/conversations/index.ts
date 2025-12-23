import { Conversation, z } from "@botpress/runtime";

import { ToolWithApproval } from "./tool-with-approval";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z
    .object({})
    // Extend the conversation state to include the pending approvals
    .extend(ToolWithApproval.ApprovalState),

  handler: async ({ execute, state }) => {
    // Define a tool that requires approval instead of "Autonomous.Tool"
    const FooTool = new ToolWithApproval({
      state,
      name: "foo",
      description: "Does a foo thing",
      input: z.object({
        x: z.number(),
        y: z.number(),
      }),
      output: z.object({
        result: z.number(),
      }),
      handler: async (input) => {
        return { result: Math.round((input.x + input.y) * Math.PI) };
      },
    });

    await execute({
      instructions:
        "Use the foo tool to calculate a value. When needed, ask the user for approval using buttons for 'Approve' and 'Reject'.",
      tools: [FooTool],
    });
  },
});
