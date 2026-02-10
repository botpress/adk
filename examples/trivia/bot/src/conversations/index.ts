/**
 * @conversation Trivia - Main Conversation Handler
 *
 * WHY IT'S BUILT THIS WAY:
 * This conversation handler implements the "chain of responsibility" pattern for message
 * routing. Instead of a single monolithic handler, messages pass through an ordered chain
 * of partial handlers (lobbyHandler, gameHostHandler), each of which can:
 * - Claim the message (handled: true, continue: false) — stops the chain
 * - Process and pass through (handled: true, continue: true) — middleware pattern
 * - Skip (handled: false) — next handler gets a chance
 *
 * WHY CHAIN OF RESPONSIBILITY (not if/else routing):
 * The trivia game has fundamentally different message types (lobby JSON protocol, game host
 * commands, player chat). Each handler is self-contained and handles only its domain. Adding
 * a new message type means adding a new handler to the chain — no need to modify existing
 * handlers. This is more maintainable than a growing if/else tree.
 *
 * WHY NO execute() CALL IN THIS HANDLER:
 * Unlike every other agent, the trivia game's main handler doesn't call execute(). This is
 * because the trivia game is event-driven, not conversational — players send JSON-encoded
 * commands (create_request, join_request, start_game) and receive JSON-encoded events
 * (participant_added, game_started). There's no natural language processing in the main
 * handler. The LLM is only used inside the play-quiz workflow to generate questions.
 *
 * WHY events: ["webchat:trigger"]:
 * The handler listens for webchat trigger events in addition to regular messages. The
 * frontend uses triggers (not messages) for game actions like start_game and update_settings
 * because triggers don't appear in the chat transcript — they're invisible control signals.
 *
 * WHY ConversationState INCLUDES A WORKFLOW REFERENCE:
 * The game state includes Reference.Workflow("play_quiz"), which points to the running
 * game workflow. This allows the conversation handler to monitor game progress and react
 * when the workflow completes (e.g., display final scores).
 */
import { Conversation } from "@botpress/runtime";
import { lobbyHandler } from "./lobby";
import { gameHostHandler } from "./game-host";
import { ConversationState, PartialHandler } from "./types";

/**
 * Partial handlers in priority order. The chain processes messages top-to-bottom:
 * 1. lobbyHandler: Handles JSON lobby protocol (create/join/leave requests)
 * 2. gameHostHandler: Handles game host commands (start_game, update_settings)
 * If neither handler claims the message, it falls through to the type-based routing below.
 */
const handlers: ReadonlyArray<PartialHandler> = [
  lobbyHandler,
  gameHostHandler,
] as const;

export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: ConversationState,
  events: ["webchat:trigger"],
  handler: async (props) => {
    const { conversation } = props;

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
