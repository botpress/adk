import { Conversation, z } from "@botpress/runtime";
import { fireAndForgetConversation } from "./fire-forget";
import { identifyHandler, DemoType } from "./identify";
import { PartialHandler } from "./types";

const handlers: ReadonlyArray<PartialHandler> = [
  identifyHandler,
  fireAndForgetConversation,
] as const;

export const Webchat = new Conversation({
  channel: "webchat.channel",
  events: ["webchat:trigger"],
  state: z.object({
    logsMessageId: z.string().optional(),
    demoType: DemoType.optional(),
  }),
  handler: async (props) => {
    /**
     * This is a pattern to allow multiple partial handlers to process the event in sequence.  Each handler can decide to:
     * - Handle the event and stop further processing (handled: true, continue: false)
     * - Handle the event and allow further processing (handled: true, continue: true)
     * This is useful for modularizing event handling logic and allowing for extensibility.
     * It helps keep the main handler clean and focused on orchestrating the flow rather than implementing specific logic.
     */
    for (const handler of handlers) {
      const result = await handler(props);
      if (result.handled) {
        if (result.continue) {
          // Continue to the "execute" phase
          break;
        } else {
          // Stop processing completely
          return;
        }
      }
    }

    /**
     * This is the "catch-all" or default execution phase if no handler fully handled the event, or if all handlers allowed continuation
     */
    await props.execute({
      instructions: "",
    });
  },
});
