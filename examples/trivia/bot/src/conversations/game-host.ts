import { context, user, z } from "@botpress/runtime";
import { PartialHandler } from "./types";

// ============================================
// Game Settings Schema (shared between request and response)
// ============================================

export const GameSettingsSchema = z.object({
  categories: z.array(z.string()),
  difficulty: z.enum(["easy", "medium", "hard", "any"]),
  language: z.string(),
  questionCount: z.number(),
  scoreMethod: z.enum(["first-right", "time-right", "all-right"]),
  timerSeconds: z.number(),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;

// ============================================
// Game Request Messages (Frontend -> Bot)
// ============================================

export const UpdateSettingsRequestSchema = z.object({
  type: z.literal("update_settings"),
  settings: GameSettingsSchema,
});

export const StartGameRequestSchema = z.object({
  type: z.literal("start_game"),
});

export const GameRequestSchema = z.discriminatedUnion("type", [
  UpdateSettingsRequestSchema,
  StartGameRequestSchema,
]);

export type UpdateSettingsRequest = z.infer<typeof UpdateSettingsRequestSchema>;
export type StartGameRequest = z.infer<typeof StartGameRequestSchema>;
export type GameRequest = z.infer<typeof GameRequestSchema>;

// ============================================
// Game Event Messages (Bot -> Frontend)
// ============================================

export type GameSettingsUpdatedEvent = {
  type: "game_settings_updated";
  settings: GameSettings;
};

export type GameStartedEvent = {
  type: "game_started";
};

type GameEvent = GameSettingsUpdatedEvent | GameStartedEvent;

/**
 * Helper to send a game event message in the game conversation
 */
async function sendGameEvent(
  client: any,
  botId: string,
  gameConversationId: string,
  event: GameEvent
) {
  await client.createMessage({
    conversationId: gameConversationId,
    userId: botId,
    type: "text",
    payload: {
      text: JSON.stringify(event),
    },
    tags: {},
  });
}

export const gameHostHandler: PartialHandler = async (props) => {
  if (props.conversation.tags.type !== "game") {
    // Not a game conversation
    return { handled: false };
  }

  if (props.conversation.tags.creatorUserId !== user.id) {
    // Only the game creator handles these events
    return { handled: false };
  }

  let request: GameRequest | null = null;

  if (props.event?.type === "webchat:trigger") {
    // Event structure: props.event.payload.payload = { action, settings, ... }
    const innerPayload = (props.event.payload as any)?.payload;
    if (innerPayload?.action) {
      const data = { type: innerPayload.action, ...innerPayload };
      const parsed = GameRequestSchema.safeParse(data);
      if (parsed.success) {
        request = parsed.data;
      } else {
        console.warn("[GameHost] Invalid game request:", parsed.error);
      }
    }
  } else if (
    props.message?.type === "text" &&
    props.message.payload.text.startsWith("{")
  ) {
    const parsed = GameRequestSchema.safeParse(
      JSON.parse(props.message.payload.text)
    );
    if (parsed.success) {
      request = parsed.data;
    } else {
      console.warn(
        "[GameHost] Invalid game request in text message",
        parsed.error
      );
    }
  }

  if (!request) {
    // Not a valid game request
    return { handled: true, continue: false };
  }

  const { client, conversation } = props;
  const botId = context.get("botId");

  // Handle update_settings
  if (request.type === "update_settings") {
    console.log("[GameHost] Updating settings:", request.settings);

    // Broadcast settings update to all participants
    await sendGameEvent(client, botId, conversation.id, {
      type: "game_settings_updated",
      settings: request.settings,
    });

    console.log("[GameHost] Settings broadcast to game:", conversation.id);
    return { handled: true, continue: false };
  }

  // Handle start_game
  if (request.type === "start_game") {
    console.log("[GameHost] Starting game request received");

    // Check if game is in waiting status
    if (conversation.tags.status !== "waiting") {
      console.warn("[GameHost] Cannot start game - status is not waiting:", conversation.tags.status);
      return { handled: true, continue: false };
    }

    // Get participants to check count
    const { participants } = await client.listParticipants({
      id: conversation.id,
    });

    if (participants.length < 2) {
      console.warn("[GameHost] Cannot start game - need at least 2 participants, got:", participants.length);
      return { handled: true, continue: false };
    }

    console.log("[GameHost] Starting game with", participants.length, "participants");

    // Update conversation status to playing
    conversation.tags.status = "playing";

    // Broadcast game_started event to all participants
    await sendGameEvent(client, botId, conversation.id, {
      type: "game_started",
    });

    console.log("[GameHost] Game started, status updated to playing");
    return { handled: true, continue: false };
  }

  return { handled: true, continue: false };
};
