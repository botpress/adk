import { z } from "@botpress/runtime";
import { PartialHandler } from "./types";
import { parseTrigger } from "../utils/event-guards";
import { pushActivity } from "../utils/push-activity";

export type TrackRequest = z.infer<typeof TrackRequest>;
export const TrackRequest = z.object({
  type: z.literal("track:event"),
  payload: z.object({
    name: z.string(),
    properties: z.record(z.any()).optional(),
  }),
});

export type FireAndForgetEvent = z.infer<typeof FireAndForgetEvent>;
export const FireAndForgetEvent = z.discriminatedUnion("type", [TrackRequest]);

export const fireAndForgetConversation: PartialHandler = async (props) => {
  const parsed = parseTrigger(props.event, FireAndForgetEvent);

  if (!parsed) {
    return { handled: false };
  }

  console.log("Fire-and-forget event received:", parsed);

  // Push activity to table and update live activity log
  if (props.state.logsMessageId) {
    await pushActivity(
      props.conversation.id,
      {
        type: parsed.payload.name,
        payload: parsed.payload.properties ?? {},
      },
      props.state.logsMessageId
    );
  }

  return { handled: true, continue: false };
};
