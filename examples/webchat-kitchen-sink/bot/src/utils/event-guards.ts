import { z } from "@botpress/runtime";

export type WebchatTriggerEvent = z.infer<typeof WebchatTriggerSchema>;
const WebchatTriggerSchema = z.object({
  type: z.literal("webchat:trigger"),
  payload: z.object({
    payload: z.any(),
  }),
});

export function isWebchatTrigger(event: unknown): event is WebchatTriggerEvent {
  if (!event || typeof event !== "object") return false;
  return WebchatTriggerSchema.safeParse(event).success;
}

export function parseTrigger<T extends z.ZodType>(
  event: unknown,
  schema: T
): z.infer<T> | null {
  if (!isWebchatTrigger(event)) {
    return null;
  }

  const result = schema.safeParse(event.payload.payload);
  if (!result.success) {
    return null;
  }

  return result.data;
}
