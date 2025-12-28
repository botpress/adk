import { Conversation } from "@botpress/runtime";
import { lobbyHandler } from "./lobby";
import { gameHostHandler } from "./game-host";
import { ConversationState, PartialHandler } from "./types";

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
