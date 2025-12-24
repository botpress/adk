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

export type LobbyRequest = LobbyInit | JoinRequest | CreateRequest;

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

export type LobbyResponse = LobbyInitResponse | JoinResponse | CreateResponse;

// ============================================
// Type guards
// ============================================

export function isLobbyResponse(data: unknown): data is LobbyResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.type === "lobby_init_response" ||
    obj.type === "join_response" ||
    obj.type === "create_response"
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
