import { context, z } from "@botpress/runtime";
import { ConversationHandlerProps, ConversationHandlerResult, GameSettingsSchema } from "../types";

export const UpdateSettingsRequestSchema = z.object({
  type: z.literal("update_settings"),
  settings: GameSettingsSchema,
});

export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;

export type GameSettingsUpdatedEvent = {
  type: "game_settings_updated";
  settings: z.infer<typeof GameSettingsSchema>;
};

export async function handleUpdateSettings(
  props: ConversationHandlerProps,
  request: UpdateSettingsRequest
): Promise<ConversationHandlerResult> {
  const { client, conversation } = props;
  const botId = context.get("botId");

  console.log("[GameHost] Updating settings:", request.settings);

  // Save settings to conversation state
  props.state.settings = request.settings;

  // Broadcast settings update to all participants
  const event: GameSettingsUpdatedEvent = {
    type: "game_settings_updated",
    settings: request.settings,
  };

  await client.createMessage({
    conversationId: conversation.id,
    userId: botId,
    type: "text",
    payload: { text: JSON.stringify(event) },
    tags: {},
  });

  console.log("[GameHost] Settings saved and broadcast to game:", conversation.id);
  return { handled: true, continue: false };
}
