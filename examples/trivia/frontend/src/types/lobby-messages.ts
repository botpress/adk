/**
 * Lobby message types for communication between frontend and bot.
 * These types should match the schemas defined in:
 * ../../../bot/src/types/lobby-messages.ts
 */

import type { GameSettings } from "./game-settings";

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
// Game Request Messages (Frontend -> Bot, sent in game conversation)
// ============================================

export type UpdateSettingsRequest = {
  type: "update_settings";
  settings: GameSettings;
};

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
  isCreator?: boolean;
};

export type ParticipantRemovedEvent = {
  type: "participant_removed";
  userId: string;
};

export type GameSettingsUpdatedEvent = {
  type: "game_settings_updated";
  settings: GameSettings;
};

export type GameStartedEvent = {
  type: "game_started";
};

export type GameCancelledEvent = {
  type: "game_cancelled";
};

// ============================================
// Workflow Events (Bot -> Frontend, sent during gameplay)
// ============================================

export type DelegateInfo = {
  id: string;
  ack_url: string;
  fulfill_url: string;
  reject_url: string;
};

export type QuestionStartEvent = {
  type: "question_start";
  questionIndex: number;
  totalQuestions: number;
  question: string;
  questionType: "true_false" | "multiple_choice" | "text_input";
  options?: string[];
  category?: string;
  difficulty?: string;
  timerSeconds: number;
  delegates: Record<string, DelegateInfo>;
};

export type QuestionScoreEntry = {
  visibleUserId: string;
  username: string;
  answer?: string;
  isCorrect: boolean;
  points: number;
  cumulativeScore: number;
  timeToAnswerMs?: number;
};

export type QuestionScoresEvent = {
  type: "question_scores";
  questionIndex: number;
  totalQuestions: number;
  correctAnswer: string;
  scores: QuestionScoreEntry[];
};

export type LeaderboardEntry = {
  rank: number;
  visibleUserId: string;
  username: string;
  score: number;
};

export type GameScoresEvent = {
  type: "game_scores";
  leaderboard: LeaderboardEntry[];
};

export type GameEndedEvent = {
  type: "game_ended";
  leaderboard: LeaderboardEntry[];
};

export type WorkflowEvent = QuestionStartEvent | QuestionScoresEvent | GameScoresEvent | GameEndedEvent;

export type GameEvent = ParticipantAddedEvent | ParticipantRemovedEvent | GameSettingsUpdatedEvent | GameStartedEvent | GameCancelledEvent | WorkflowEvent;

export function isGameEvent(data: unknown): data is GameEvent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    obj.type === "participant_added" ||
    obj.type === "participant_removed" ||
    obj.type === "game_settings_updated" ||
    obj.type === "game_started" ||
    obj.type === "game_cancelled" ||
    obj.type === "question_start" ||
    obj.type === "question_scores" ||
    obj.type === "game_scores" ||
    obj.type === "game_ended"
  );
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
