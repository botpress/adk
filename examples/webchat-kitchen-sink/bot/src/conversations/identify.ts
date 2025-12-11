import { z } from "@botpress/runtime";
import { PartialHandler } from "./types";
import { parseTrigger } from "../utils/event-guards";
import { ACTIVITY_LOGS_URL } from "../utils/push-activity";

export const DemoType = z.enum([
  "fire-and-forget",
  "request-response",
  "custom-blocks",
  "bot-requests",
]);

export type DemoType = z.infer<typeof DemoType>;

export type IdentifyEvent = z.infer<typeof IdentifyEvent>;
export const IdentifyEvent = z.object({
  type: z.literal("identify"),
  payload: z.object({
    demoType: DemoType,
  }),
});

export const identifyHandler: PartialHandler = async (props) => {
  const parsed = parseTrigger(props.event, IdentifyEvent);

  if (!parsed) {
    return { handled: false };
  }

  // Check if already identified - cannot change once set
  if (props.state.demoType) {
    console.warn(
      `Conversation ${props.conversation.id} already identified as "${props.state.demoType}", ignoring identify event for "${parsed.payload.demoType}"`
    );
    return { handled: true, continue: false };
  }

  // Set the demo type
  props.state.demoType = parsed.payload.demoType;
  console.log(
    `Conversation ${props.conversation.id} identified as "${parsed.payload.demoType}"`
  );

  // Initialize logs message on identify
  if (!props.state.logsMessageId) {
    const { id } = await props.conversation.send({
      type: "custom",
      payload: {
        url: ACTIVITY_LOGS_URL,
        name: "Activity Logs",
        data: {},
      },
    });
    props.state.logsMessageId = id;
  }

  return { handled: true, continue: false };
};
