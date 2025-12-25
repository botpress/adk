import { Conversation, context, z } from "@botpress/runtime";
import {
  parseLobbyRequest,
  type CreateResponse,
  type JoinResponse,
  type LeaveResponse,
  type ParticipantAddedEvent,
  type ParticipantRemovedEvent,
} from "../types/lobby-messages";
import { generateUniqueJoinCode } from "../utils/join-code";

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
 * Helper to send a JSON response in the lobby conversation
 */
async function sendLobbyResponse(
  conversationId: string,
  response: JoinResponse | CreateResponse | LeaveResponse
) {
  await context.get("client").createMessage({
    conversationId,
    userId: context.get("botId"),
    type: "text",
    payload: {
      text: JSON.stringify(response),
    },
    tags: {},
  });
}

/**
 * Helper to send a game event message in the game conversation
 */
async function sendGameEvent(
  gameConversationId: string,
  event: ParticipantAddedEvent | ParticipantRemovedEvent
) {
  await context.get("client").createMessage({
    conversationId: gameConversationId,
    userId: context.get("botId"),
    type: "text",
    payload: {
      text: JSON.stringify(event),
    },
    tags: {},
  });
}


/**
 * Main Webchat Conversation Handler
 *
 * Handles:
 * - Lobby messages (join_request, create_request, lobby_init)
 * - Game conversations (chat with AI host)
 */
export default new Conversation({
  channel: "webchat.channel",
  state: ConversationState,

  handler: async ({ client, conversation, message }) => {
    console.log("[Conversation] Handling event:", {
      conversationType: conversation.tags.type,
      conversationId: conversation.id,
    });

    // ========================================
    // Handle text messages - check for lobby requests
    // ========================================
    if (message?.type === "text") {
      const text = message.payload.text;
      const lobbyRequest = parseLobbyRequest(text);

      if (lobbyRequest) {
        console.log("[Conversation] Received lobby request:", lobbyRequest);

        // Handle lobby_init - mark this conversation as a lobby
        if (lobbyRequest.type === "lobby_init") {
          conversation.tags.type = "lobby";
          console.log("[Conversation] Initialized as lobby conversation");
          return;
        }

        // Handle create_request
        if (lobbyRequest.type === "create_request") {
          const { gameConversationId } = lobbyRequest;
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

            // Send participant_added event for the creator
            await sendGameEvent(gameConversationId, {
              type: "participant_added",
              userId: visibleUserId,
            });

            console.log(
              "[Conversation] Game created with join code:",
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
            await sendLobbyResponse(conversation.id, response);
          } catch (error) {
            console.error("[Conversation] Failed to create game:", error);
            const response: CreateResponse = {
              type: "create_response",
              success: false,
              error: "Failed to create game. Please try again.",
            };
            await sendLobbyResponse(conversation.id, response);
          }
          return;
        }

        // Handle join_request
        if (lobbyRequest.type === "join_request") {
          const { joinCode } = lobbyRequest;
          const code = joinCode.toUpperCase();
          const visibleUserId = message.userId;

          try {
            // Find the game conversation by join code tag
            const { conversations } = await client.listConversations({
              tags: {
                code,
                status: "waiting",
                type: "game",
              },
            });

            if (conversations.length === 0) {
              const response: JoinResponse = {
                type: "join_response",
                success: false,
                error: "Invalid join code or game has already started.",
              };
              await sendLobbyResponse(conversation.id, response);
              return;
            }

            const gameConversation = conversations[0];

            // Add joining player as a real participant so they can access the conversation
            await client.addParticipant({
              id: gameConversation.id,
              userId: visibleUserId,
            });

            // Send participant_added event for the joining player
            await sendGameEvent(gameConversation.id, {
              type: "participant_added",
              userId: visibleUserId,
            });

            console.log(
              "[Conversation] Player joined game:",
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
            await sendLobbyResponse(conversation.id, response);
          } catch (error) {
            console.error("[Conversation] Failed to join game:", error);
            const response: JoinResponse = {
              type: "join_response",
              success: false,
              error: "Failed to join game. Please try again.",
            };
            await sendLobbyResponse(conversation.id, response);
          }
          return;
        }

        // Handle leave_request
        if (lobbyRequest.type === "leave_request") {
          const { gameConversationId } = lobbyRequest;
          const visibleUserId = message.userId;
          const lobbyConversationId = conversation.id;

          try {
            // Fetch the game conversation to get creator userId
            const { conversation: gameConversation } =
              await client.getConversation({
                id: gameConversationId,
              });

            const creatorUserId = gameConversation.tags.creatorUserId as string;
            const isCreator = visibleUserId === creatorUserId;

            if (isCreator) {
              // If creator leaves, delete the entire game conversation
              console.log(
                "[Conversation] Creator leaving game, deleting conversation:",
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
              await sendGameEvent(gameConversationId, {
                type: "participant_removed",
                userId: visibleUserId,
              });
            }

            console.log(
              "[Conversation] Player left game:",
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
            await sendLobbyResponse(lobbyConversationId, response);
          } catch (error) {
            console.error("[Conversation] Failed to leave game:", error);
            const response: LeaveResponse = {
              type: "leave_response",
              success: false,
              error: "Failed to leave game.",
            };
            await sendLobbyResponse(lobbyConversationId, response);
          }
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
