export type ScoreMethod = "first-right" | "time-right" | "all-right";
export type Difficulty = "easy" | "medium" | "hard" | "any";

export type GameSettings = {
  categories: string[];
  difficulty: Difficulty;
  language: string;
  questionCount: number;
  scoreMethod: ScoreMethod;
  timerSeconds: number;
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  categories: ["any"],
  difficulty: "easy",
  language: "english",
  questionCount: 10,
  scoreMethod: "all-right",
  timerSeconds: 20,
};

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "any", label: "Any" },
];

export const SCORE_METHOD_OPTIONS: { value: ScoreMethod; label: string; description: string }[] = [
  { value: "first-right", label: "First Right", description: "First correct answer gets 100 points" },
  { value: "time-right", label: "Speed Bonus", description: "Points based on answer speed" },
  { value: "all-right", label: "All Right", description: "Everyone correct gets 100 points" },
];

export const CATEGORY_OPTIONS = [
  { value: "any", label: "Any Category" },
  { value: "general", label: "General Knowledge" },
  { value: "science", label: "Science" },
  { value: "history", label: "History" },
  { value: "geography", label: "Geography" },
  { value: "entertainment", label: "Entertainment" },
  { value: "sports", label: "Sports" },
  { value: "art", label: "Art & Literature" },
];

export const LANGUAGE_OPTIONS = [
  { value: "english", label: "English" },
  { value: "spanish", label: "Spanish" },
  { value: "french", label: "French" },
  { value: "german", label: "German" },
];
