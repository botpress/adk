import { Conversation, z } from "@botpress/runtime";
import { lobbyHandler } from "./lobby";
import { gameHostHandler } from "./game-host";
import { PartialHandler } from "./types";

/**
 * Player schema
 */
const PlayerSchema = z.object({
  visibleUserId: z.string(),
  visibleConversationId: z.string(),
  username: z.string(),
  score: z.number().default(0),
  isCreator: z.boolean().default(false),
});

export type Player = z.infer<typeof PlayerSchema>;
export { PlayerSchema };

/**
 * Game settings schema
 */
const GameSettingsSchema = z.object({
  categories: z.array(z.string()).default(["any"]),
  difficulty: z.enum(["easy", "medium", "hard", "any"]).default("easy"),
  questionCount: z.number().min(5).max(50).default(10),
  scoreMethod: z
    .enum(["first-right", "time-right", "all-right"])
    .default("all-right"),
  timerSeconds: z.number().min(10).max(60).default(20),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;
export { GameSettingsSchema };

/**
 * Conversation state for trivia game
 */
const ConversationState = z.object({
  // Game state (only for game conversations)
  players: z.array(PlayerSchema).default([]),
  settings: GameSettingsSchema.optional(),
  questions: z.array(z.any()).default([]),
  currentQuestionIndex: z.number().default(0),
});

/**
 * Partial handlers to process events in sequence.
 * Each handler can decide to:
 * - Handle the event and stop further processing (handled: true, continue: false)
 * - Handle the event and allow further processing (handled: true, continue: true)
 * - Not handle the event (handled: false)
 */
const handlers: ReadonlyArray<PartialHandler> = [
  lobbyHandler,
  gameHostHandler,
] as const;

/**
 * Main Webchat Conversation Handler
 *
 * Handles:
 * - Lobby messages (join_request, create_request, lobby_init)
 * - Game conversations (chat with AI host)
 */
export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: ConversationState,
  events: ["webchat:trigger"],
  handler: async (props) => {
    const { conversation } = props;

    console.log("[Conversation] Handling event:", {
      conversationType: conversation.tags.type,
      conversationId: conversation.id,
      tags: conversation.tags,
    });

    // Run through partial handlers
    for (const handler of handlers) {
      const result = await handler(props);
      if (result.handled) {
        if (result.continue) {
          // Continue to next handler
          continue;
        } else {
          // Stop processing completely
          return;
        }
      }
    }

    // ========================================
    // If this is a lobby conversation, don't process further
    // ========================================
    if (conversation.tags.type === "lobby") {
      console.log(
        "[Conversation] Lobby conversation, ignoring non-lobby message"
      );
      return;
    }

    // ========================================
    // Game conversation - handle game logic
    // ========================================
    if (conversation.tags.type === "game") {
      console.log(
        "[Conversation] Game conversation, status:",
        conversation.tags.status
      );
      // Game logic will be handled here
      // For now, just log
      return;
    }

    // Unknown conversation type
    console.log("[Conversation] Unknown conversation type, ignoring");
  },
});
