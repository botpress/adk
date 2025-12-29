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
  difficulties: ("easy" | "medium" | "hard")[];
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
  questionType: "true_false" | "multiple_choice" | "text_input" | "map_country" | "flag_country";
  options?: string[];
  category?: string;
  difficulty?: string;
  timerSeconds: number;
  language?: string;
  delegate: Delegate;
  // For map questions (guess the highlighted country)
  mapData?: {
    countryCode: string;
    countryAlpha3: string;
    center: [number, number];
    zoom: number;
  };
  // For flag questions (guess country by flag)
  flagData?: {
    countryCode: string;
    flagUrl: string;
  };
}

export interface PlayerAnswer {
  username: string;
  answer?: string;
  isCorrect: boolean;
  points: number;
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
  playerAnswers: PlayerAnswer[];
  isLastQuestion: boolean;
  isCreator: boolean;
}

export interface LeaderboardData {
  gameId: number;
  leaderboard: LeaderboardEntry[];
  isCreator: boolean;
  onClose?: () => void;
}
