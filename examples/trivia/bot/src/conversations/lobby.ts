/**
 * @handler Lobby Handler
 * @pattern JSON Protocol Over Text Messages
 *
 * WHY THIS EXISTS:
 * The lobby handler manages the pre-game lifecycle: creating game rooms, joining with codes,
 * and leaving games. It communicates with the frontend via a JSON protocol encoded in text
 * messages — not natural language.
 *
 * WHY JSON OVER TEXT MESSAGES (not a custom integration):
 * ADK's webchat integration supports text messages natively. By encoding structured data as
 * JSON strings in text messages, we get a bidirectional communication channel without needing
 * a custom integration. The handler checks if messages start with "{" and attempts Zod parsing.
 * Non-JSON messages pass through to other handlers.
 *
 * HOW THE GAME ROOM SYSTEM WORKS:
 * 1. CREATING: Creator sends { type: "create_request", gameConversationId: "..." }
 *    - The frontend pre-creates the conversation via the Botpress API
 *    - The lobby handler tags it with type="game", code="ABCD", status="waiting"
 *    - The creator is added as a participant (not just a conversation member)
 *    - A join code is generated and returned to the creator
 *
 * 2. JOINING: Player sends { type: "join_request", joinCode: "ABCD" }
 *    - The handler searches for conversations with matching code and status="waiting"
 *    - Player is added as a participant to the game conversation
 *    - A participant_added event is broadcast to all players in the game
 *
 * 3. LEAVING: Player sends { type: "leave_request", gameConversationId: "..." }
 *    - If the creator leaves: game is cancelled and all players notified
 *    - If a non-creator leaves: they're removed as a participant
 *
 * WHY CONVERSATION TAGS (not a database):
 * Game rooms are modeled as conversations with tags (type, code, status, creatorUserId).
 * This leverages ADK's built-in conversation search — finding a game by join code is just
 * `client.listConversations({ tags: { code: "ABCD", type: "game", status: "waiting" } })`.
 * No separate database needed.
 *
 * WHY DISCRIMINATED UNION FOR REQUEST SCHEMA:
 * z.discriminatedUnion on the "type" field ensures type safety: each request type has
 * exactly the fields it needs (create_request has gameConversationId, join_request has
 * joinCode). Zod validation catches malformed requests before any logic runs.
 */
import { context, z } from "@botpress/runtime";
import { generateUniqueJoinCode } from "../utils/join-code";
import { PartialHandler } from "./types";

// ============================================
// Lobby Request Messages (Frontend -> Bot)
// Each request type has a Zod schema for validation.
// The discriminated union on "type" enables type-safe parsing.
// ============================================

export const LobbyInitSchema = z.object({
  type: z.literal("lobby_init"),
});

export const CreateRequestSchema = z.object({
  type: z.literal("create_request"),
  gameConversationId: z.string(),
});

export const JoinRequestSchema = z.object({
  type: z.literal("join_request"),
  joinCode: z.string(),
});

export const LeaveRequestSchema = z.object({
  type: z.literal("leave_request"),
  gameConversationId: z.string(),
});

export const LobbyRequestSchema = z.discriminatedUnion("type", [
  LobbyInitSchema,
  CreateRequestSchema,
  JoinRequestSchema,
  LeaveRequestSchema,
]);

export type LobbyInit = z.infer<typeof LobbyInitSchema>;
export type CreateRequest = z.infer<typeof CreateRequestSchema>;
export type JoinRequest = z.infer<typeof JoinRequestSchema>;
export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;
export type LobbyRequest = z.infer<typeof LobbyRequestSchema>;

// ============================================
// Lobby Response Messages (Bot -> Frontend)
// ============================================

export type JoinResponse = {
  type: "join_response";
  success: boolean;
  conversationId?: string;
  error?: string;
};

export type CreateResponse = {
  type: "create_response";
  success: boolean;
  conversationId?: string;
  joinCode?: string;
  error?: string;
};

export type LeaveResponse = {
  type: "leave_response";
  success: boolean;
  error?: string;
};

// ============================================
// Game Event Messages (Bot -> Frontend, sent in game conversation)
// ============================================

export type ParticipantAddedEvent = {
  type: "participant_added";
  userId: string;
  isCreator?: boolean;
};

export type ParticipantRemovedEvent = {
  type: "participant_removed";
  userId: string;
};

export type GameCancelledEvent = {
  type: "game_cancelled";
};

// ============================================
// Helpers
// ============================================

async function sendLobbyResponse(
  client: any,
  botId: string,
  conversationId: string,
  response: JoinResponse | CreateResponse | LeaveResponse
) {
  await client.createMessage({
    conversationId,
    userId: botId,
    type: "text",
    payload: {
      text: JSON.stringify(response),
    },
    tags: {},
  });
}

async function sendGameEvent(
  client: any,
  botId: string,
  gameConversationId: string,
  event: ParticipantAddedEvent | ParticipantRemovedEvent | GameCancelledEvent
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

// ============================================
// Lobby Handler
// ============================================

export const lobbyHandler: PartialHandler = async (props) => {
  const { client, conversation, message } = props;
  const botId = context.get("botId");

  // Only handle text messages
  if (message?.type !== "text") {
    return { handled: false };
  }

  const text = message.payload.text;

  // Try to parse as JSON
  if (!text.startsWith("{")) {
    return { handled: false };
  }

  let parsed: ReturnType<typeof LobbyRequestSchema.safeParse>;
  try {
    parsed = LobbyRequestSchema.safeParse(JSON.parse(text));
  } catch {
    return { handled: false };
  }

  if (!parsed.success) {
    return { handled: false };
  }

  const request = parsed.data;
  console.log("[Lobby] Received lobby request:", request);

  // Handle lobby_init - mark this conversation as a lobby
  if (request.type === "lobby_init") {
    conversation.tags.type = "lobby";
    console.log("[Lobby] Initialized as lobby conversation");
    return { handled: true, continue: false };
  }

  // Handle create_request
  if (request.type === "create_request") {
    const { gameConversationId } = request;
    const visibleUserId = message.userId;

    try {
      // Generate join code
      const joinCode = await generateUniqueJoinCode(client);

      // Update the game conversation with tags (including creatorUserId)
      await client.updateConversation({
        id: gameConversationId,
        tags: {
          type: "game",
          code: joinCode,
          status: "waiting",
          creatorUserId: visibleUserId,
        },
      });

      // Add creator as a real participant so they can access the conversation
      await client.addParticipant({
        id: gameConversationId,
        userId: visibleUserId,
      });

      // Send participant_added event for the creator (with isCreator flag)
      await sendGameEvent(client, botId, gameConversationId, {
        type: "participant_added",
        userId: visibleUserId,
        isCreator: true,
      });

      console.log(
        "[Lobby] Game created with join code:",
        joinCode,
        "creator:",
        visibleUserId
      );

      // Send success response
      const response: CreateResponse = {
        type: "create_response",
        success: true,
        conversationId: gameConversationId,
        joinCode,
      };
      await sendLobbyResponse(client, botId, conversation.id, response);
    } catch (error) {
      console.error("[Lobby] Failed to create game:", error);
      const response: CreateResponse = {
        type: "create_response",
        success: false,
        error: "Failed to create game. Please try again.",
      };
      await sendLobbyResponse(client, botId, conversation.id, response);
    }
    return { handled: true, continue: false };
  }

  // Handle join_request
  if (request.type === "join_request") {
    const { joinCode } = request;
    const code = joinCode.toUpperCase();
    const visibleUserId = message.userId;

    try {
      // Find the game conversation by join code tag
      const { conversations } = await client.listConversations({
        tags: {
          code,
          type: "game",
          status: "waiting",
        },
      });

      console.log(
        "[Lobby] Join search results for code:",
        code,
        "found:",
        conversations.length,
        "conversations"
      );

      if (conversations.length === 0) {
        const response: JoinResponse = {
          type: "join_response",
          success: false,
          error: "Invalid join code or game is no longer available.",
        };
        await sendLobbyResponse(client, botId, conversation.id, response);
        return { handled: true, continue: false };
      }

      const gameConversation = conversations[0];

      // Double-check the game is still in waiting status (not cancelled or started)
      if (gameConversation.tags.status !== "waiting") {
        const response: JoinResponse = {
          type: "join_response",
          success: false,
          error: "This game is no longer accepting players.",
        };
        await sendLobbyResponse(client, botId, conversation.id, response);
        return { handled: true, continue: false };
      }

      // Add joining player as a real participant so they can access the conversation
      await client.addParticipant({
        id: gameConversation.id,
        userId: visibleUserId,
      });

      // Send participant_added event for the joining player
      await sendGameEvent(client, botId, gameConversation.id, {
        type: "participant_added",
        userId: visibleUserId,
      });

      console.log(
        "[Lobby] Player joined game:",
        code,
        "userId:",
        visibleUserId
      );

      // Send success response - player will use the game conversation
      const response: JoinResponse = {
        type: "join_response",
        success: true,
        conversationId: gameConversation.id,
      };
      await sendLobbyResponse(client, botId, conversation.id, response);
    } catch (error) {
      console.error("[Lobby] Failed to join game:", error);
      const response: JoinResponse = {
        type: "join_response",
        success: false,
        error: "Failed to join game. Please try again.",
      };
      await sendLobbyResponse(client, botId, conversation.id, response);
    }
    return { handled: true, continue: false };
  }

  // Handle leave_request
  if (request.type === "leave_request") {
    const { gameConversationId } = request;
    const visibleUserId = message.userId;
    const lobbyConversationId = conversation.id;

    try {
      // Fetch the game conversation to get creator userId
      const { conversation: gameConversation } = await client.getConversation({
        id: gameConversationId,
      });

      const creatorUserId = gameConversation.tags.creatorUserId as string;
      const isCreator = visibleUserId === creatorUserId;

      if (isCreator) {
        // If creator leaves, cancel the game and notify all players
        console.log(
          "[Lobby] Creator leaving game, cancelling:",
          gameConversationId
        );

        // Send game_cancelled event to notify all players
        await sendGameEvent(client, botId, gameConversationId, {
          type: "game_cancelled",
        });

        // Update the conversation status to cancelled
        await client.updateConversation({
          id: gameConversationId,
          tags: {
            status: "cancelled",
          },
        });
      } else {
        // Remove the player as a real participant
        await client.removeParticipant({
          id: gameConversationId,
          userId: visibleUserId,
        });

        // Send participant_removed event for the leaving player
        await sendGameEvent(client, botId, gameConversationId, {
          type: "participant_removed",
          userId: visibleUserId,
        });
      }

      console.log(
        "[Lobby] Player left game:",
        gameConversationId,
        "userId:",
        visibleUserId,
        isCreator ? "(creator - game deleted)" : ""
      );

      // Send success response to the lobby conversation (not the game)
      const response: LeaveResponse = {
        type: "leave_response",
        success: true,
      };
      await sendLobbyResponse(client, botId, lobbyConversationId, response);
    } catch (error) {
      console.error("[Lobby] Failed to leave game:", error);
      const response: LeaveResponse = {
        type: "leave_response",
        success: false,
        error: "Failed to leave game.",
      };
      await sendLobbyResponse(client, botId, lobbyConversationId, response);
    }
    return { handled: true, continue: false };
  }

  return { handled: false };
};
