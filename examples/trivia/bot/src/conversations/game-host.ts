import { context, user, z } from "@botpress/runtime";
import { PartialHandler, Player } from "./types";

import PlayQuizWorkflow from "../workflows/play-quiz";

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

export const CloseGameRequestSchema = z.object({
  type: z.literal("close_game"),
});

export const GameRequestSchema = z.discriminatedUnion("type", [
  UpdateSettingsRequestSchema,
  StartGameRequestSchema,
  CloseGameRequestSchema,
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

export type GameEndedEvent = {
  type: "game_ended";
  leaderboard: Array<{
    rank: number;
    visibleUserId: string;
    username: string;
    score: number;
  }>;
};

type GameEvent = GameSettingsUpdatedEvent | GameStartedEvent | GameEndedEvent;

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

    // Save settings to conversation state
    props.state.settings = request.settings;

    // Broadcast settings update to all participants
    await sendGameEvent(client, botId, conversation.id, {
      type: "game_settings_updated",
      settings: request.settings,
    });

    console.log("[GameHost] Settings saved and broadcast to game:", conversation.id);
    return { handled: true, continue: false };
  }

  // Handle start_game
  if (request.type === "start_game") {
    console.log("[GameHost] Starting game request received");

    // Check if game is in waiting status
    if (conversation.tags.status !== "waiting") {
      console.warn(
        "[GameHost] Cannot start game - status is not waiting:",
        conversation.tags.status
      );
      return { handled: true, continue: false };
    }

    // Get participants to check count
    const { participants } = await client.listParticipants({
      id: conversation.id,
    });

    if (participants.length < 2) {
      console.warn(
        "[GameHost] Cannot start game - need at least 2 participants, got:",
        participants.length
      );
      return { handled: true, continue: false };
    }

    console.log(
      "[GameHost] Starting game with",
      participants.length,
      "participants"
    );

    // Update conversation status to playing
    conversation.tags.status = "playing";

    // Get game settings from conversation state
    const settings = props.state.settings ?? {
      categories: ["any"],
      difficulty: "easy" as const,
      questionCount: 10,
      scoreMethod: "all-right" as const,
      timerSeconds: 20,
    };

    // Build players list from participants
    const creatorUserId = conversation.tags.creatorUserId as string;
    const players: Player[] = participants.map((p) => ({
      visibleUserId: p.id,
      visibleConversationId: conversation.id,
      username: p.name || p.id.slice(0, 8),
      score: 0,
      isCreator: p.id === creatorUserId,
    }));

    console.log(
      "[GameHost] Players:",
      players.map((p) => ({ id: p.visibleUserId, isCreator: p.isCreator }))
    );
    console.log("[GameHost] Settings:", settings);

    // Start the play_quiz workflow
    props.state.game = await PlayQuizWorkflow.start({
      gameConversationId: conversation.id,
      players,
      settings,
    });

    console.log("[GameHost] Started workflow:", props.state.game.workflow.id);

    // Broadcast game_started event to all participants
    await sendGameEvent(client, botId, conversation.id, {
      type: "game_started",
    });

    console.log("[GameHost] Game started, status updated to playing");
    return { handled: true, continue: false };
  }

  // Handle close_game (after viewing final leaderboard)
  if (request.type === "close_game") {
    console.log("[GameHost] Close game request received");

    // Check if game is in ended status (or playing - workflow might have finished)
    if (conversation.tags.status !== "playing" && conversation.tags.status !== "ended") {
      console.warn(
        "[GameHost] Cannot close game - status is:",
        conversation.tags.status
      );
      return { handled: true, continue: false };
    }

    // Get the final leaderboard from the workflow state if available
    const workflowState = props.state.game;
    let leaderboard: GameEndedEvent["leaderboard"] = [];

    if (workflowState?.workflow?.output?.finalLeaderboard) {
      leaderboard = workflowState.workflow.output.finalLeaderboard;
    } else {
      // Fallback: build leaderboard from participants with 0 scores
      const { participants } = await client.listParticipants({
        id: conversation.id,
      });
      leaderboard = participants.map((p, index) => ({
        rank: index + 1,
        visibleUserId: p.id,
        username: p.name || p.id.slice(0, 8),
        score: 0,
      }));
    }

    // Update conversation status back to waiting
    conversation.tags.status = "waiting";

    // Broadcast game_ended event to all participants
    await sendGameEvent(client, botId, conversation.id, {
      type: "game_ended",
      leaderboard,
    });

    console.log("[GameHost] Game ended, status updated to waiting");
    return { handled: true, continue: false };
  }

  return { handled: true, continue: false };
};
