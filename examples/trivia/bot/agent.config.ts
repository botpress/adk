/**
 * @agent Trivia Quiz Agent
 * @pattern Event-Driven Multiplayer Game with Shared Conversations and Workflows
 *
 * WHY THIS AGENT EXISTS:
 * This agent implements a real-time multiplayer trivia game, demonstrating the most complex
 * ADK conversation patterns: multiple conversation types (lobby vs game), conversation tags
 * for routing and state, the delegate integration for cross-agent communication, event-driven
 * message handling (JSON protocol over text messages), and workflow-based game execution.
 *
 * ARCHITECTURE DECISIONS:
 *
 * - Conversation Tags as Game State: The config defines conversation tags (creatorUserId,
 *   type, status, code) that turn conversations into addressable game rooms. This is a key
 *   ADK pattern: conversations aren't just chat threads — they're stateful entities that can
 *   be queried, tagged, and found by other users.
 *
 * - Two Conversation Types (lobby vs game):
 *   * Lobby: One per user. Handles create/join/leave requests. Tagged with type="lobby".
 *   * Game: One per game room. Shared by all players. Tagged with type="game", status=
 *     "waiting"/"playing"/"completed", and code="ABCD" for joining.
 *   This separation exists because lobby actions (searching for games) and game actions
 *   (answering questions) have completely different handlers and state.
 *
 * - User State (username + currentGameCode): Persists across conversations. When a user
 *   joins a game, their currentGameCode is stored in user state so they can reconnect
 *   after page refreshes (the frontend checks user state to determine which game they're in).
 *
 * - Delegate Integration: Enables cross-conversation communication. When a player joins a
 *   game, the lobby handler needs to modify the game conversation (add participant, send
 *   events). The delegate integration allows one bot to interact with conversations it
 *   didn't create.
 *
 * - Cerebras model: Game logic is entirely deterministic (handled by code, not LLM). The
 *   LLM is only used inside the play-quiz workflow to generate trivia questions, where
 *   speed is critical (players are waiting in real-time). Cerebras's low latency is ideal.
 */
import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "trivia-quiz",
  description:
    "Multiplayer trivia quiz game - create or join games, answer timed questions, compete for the top score!",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({
      username: z.string().optional(),
      currentGameCode: z.string().optional(),
    }),
  },

  conversation: {
    tags: {
      creatorUserId: {
        title: "Creator User ID",
        description: "The user ID of the game creator",
      },
      type: {
        title: "Conversation Type",
        description: "The type of conversation (lobby or game)",
      },
      status: {
        title: "Game Status",
        description: "The current status of the trivia game",
      },
      code: {
        title: "Game Code",
        description: "The join code for the trivia game",
      },
    },
  },

  dependencies: {
    integrations: {
      delegate: { version: "agi/delegate@0.1.0", enabled: true },
      webchat: {
        version: "webchat@0.3.0",
        enabled: true,
      },
    },
  },
});
