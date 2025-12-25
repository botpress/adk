import { context, z } from "@botpress/runtime";
import { generateUniqueJoinCode } from "../utils/join-code";
import { PartialHandler } from "./types";

// ============================================
// Lobby Request Messages (Frontend -> Bot)
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
  event: ParticipantAddedEvent | ParticipantRemovedEvent
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

      if (conversations.length === 0) {
        const response: JoinResponse = {
          type: "join_response",
          success: false,
          error: "Invalid join code or game has already started.",
        };
        await sendLobbyResponse(client, botId, conversation.id, response);
        return { handled: true, continue: false };
      }

      const gameConversation = conversations[0];

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
        // If creator leaves, delete the entire game conversation
        console.log(
          "[Lobby] Creator leaving game, deleting conversation:",
          gameConversationId
        );
        await client.deleteConversation({
          id: gameConversationId,
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
