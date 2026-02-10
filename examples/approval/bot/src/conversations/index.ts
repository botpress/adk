/**
 * @conversation Approval Agent - Webchat Conversation
 *
 * WHY IT'S BUILT THIS WAY:
 * This conversation handler demonstrates the "approval gate" pattern for AI tool execution.
 * The key insight is that ToolWithApproval is a drop-in replacement for Autonomous.Tool —
 * you define tools exactly the same way, but they automatically require user approval before
 * executing. This makes it trivial to add human oversight to any existing tool.
 *
 * HOW THE APPROVAL FLOW WORKS:
 * 1. LLM decides to call "foo" with inputs {x: 3, y: 5}
 * 2. ToolWithApproval.execute() is called — but there's no pending approval yet
 * 3. It throws an error: "requires approval before execution"
 * 4. The LLM catches this error and asks the user to approve (via buttons)
 * 5. User clicks "Approve" — this creates a new user message in the transcript
 * 6. LLM retries calling "foo" with the same inputs
 * 7. ToolWithApproval.execute() sees a pending approval AND a new user message → executes
 *
 * WHY STATE EXTENSION (not separate state):
 * The state uses z.object({}).extend(ToolWithApproval.ApprovalState) rather than defining
 * pendingApprovals inline. This keeps the approval mechanism encapsulated — if you want to
 * add approval to any conversation, you just .extend() the state. The conversation's own
 * business state stays clean.
 *
 * WHY TOOLS ARE DEFINED INSIDE THE HANDLER:
 * The FooTool is created inside the handler (not at module scope) because it needs access
 * to the conversation `state` object. ToolWithApproval stores pending approvals in state,
 * so it must receive the live state reference to read/write approval records. This is a
 * deliberate ADK pattern: tools that need conversation context are defined inside handlers.
 */
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
    // Created inside the handler because it needs the live `state` reference
    // to track pending approvals across LLM iterations
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
