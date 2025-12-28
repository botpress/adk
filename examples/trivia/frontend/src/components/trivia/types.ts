/**
 * Types for trivia game custom messages
 */

export interface Player {
  visibleUserId: string;
  visibleConversationId: string;
  username: string;
  score: number;
  isCreator: boolean;
}

export interface GameSettings {
  categories: string[];
  difficulty: "easy" | "medium" | "hard" | "any";
  questionCount: number;
  scoreMethod: "first-right" | "time-right" | "all-right";
  timerSeconds: number;
}

export interface Delegate {
  id: string;
  ack_url: string;
  fulfill_url: string;
  reject_url: string;
}

export interface LeaderboardEntry {
  rank: number;
  visibleUserId?: string;
  username: string;
  score: number;
}

// Custom message payloads

export interface LobbyData {
  gameId: number;
  joinCode: string;
  players: Player[];
  settings: GameSettings;
  isCreator: boolean;
  canStart: boolean;
  newPlayer?: string;
  settingsUpdated?: boolean;
}

export interface QuestionData {
  gameId: number;
  questionIndex: number;
  totalQuestions: number;
  question: string;
  questionType: "true_false" | "multiple_choice" | "text_input";
  options?: string[];
  category?: string;
  difficulty?: string;
  timerSeconds: number;
  delegate: Delegate;
}

export interface ScoreData {
  gameId: number;
  questionIndex: number;
  totalQuestions: number;
  correctAnswer: string;
  yourAnswer?: string;
  yourPoints: number;
  isCorrect: boolean;
  leaderboard: LeaderboardEntry[];
  isLastQuestion: boolean;
  isCreator: boolean;
}

export interface LeaderboardData {
  gameId: number;
  leaderboard: LeaderboardEntry[];
  isCreator: boolean;
  onClose?: () => void;
}
