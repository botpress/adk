/**
 * Lobby message types for communication between frontend and bot.
 * These types should match the schemas defined in:
 * ../../../bot/src/types/lobby-messages.ts
 */

// ============================================
// Lobby Request Messages (Frontend -> Bot)
// ============================================

export type LobbyInit = {
  type: "lobby_init";
};

export type JoinRequest = {
  type: "join_request";
  joinCode: string;
};

export type CreateRequest = {
  type: "create_request";
  gameConversationId: string;
};

export type LeaveRequest = {
  type: "leave_request";
  gameConversationId: string;
};

export type LobbyRequest = LobbyInit | JoinRequest | CreateRequest | LeaveRequest;

// ============================================
// Lobby Response Messages (Bot -> Frontend)
// ============================================

export type LobbyInitResponse = {
  type: "lobby_init_response";
  success: true;
};

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

export type RemovedFromGameNotification = {
  type: "removed_from_game";
  gameConversationId: string;
};

export type LobbyResponse = LobbyInitResponse | JoinResponse | CreateResponse | LeaveResponse | RemovedFromGameNotification;

// ============================================
// Game Event Messages (Bot -> Frontend, sent in game conversation)
// ============================================

export type ParticipantAddedEvent = {
  type: "participant_added";
  userId: string;
};

export type ParticipantRemovedEvent = {
  type: "participant_removed";
  userId: string;
};

export type GameEvent = ParticipantAddedEvent | ParticipantRemovedEvent;

export function isGameEvent(data: unknown): data is GameEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return obj.type === "participant_added" || obj.type === "participant_removed";
}

export function parseGameEvent(text: string): GameEvent | null {
  try {
    const data = JSON.parse(text);
    if (isGameEvent(data)) {
      return data;
    }
  } catch {
    // Not JSON or not a game event
  }
  return null;
}

// ============================================
// Type guards
// ============================================

export function isLobbyResponse(data: unknown): data is LobbyResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.type === "lobby_init_response" ||
    obj.type === "join_response" ||
    obj.type === "create_response" ||
    obj.type === "leave_response" ||
    obj.type === "removed_from_game"
  );
}

export function parseLobbyResponse(text: string): LobbyResponse | null {
  try {
    const data = JSON.parse(text);
    if (isLobbyResponse(data)) {
      return data;
    }
  } catch {
    // Not JSON or not a lobby response
  }
  return null;
}
