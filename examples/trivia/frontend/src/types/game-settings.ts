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

export const QUESTION_COUNT_OPTIONS = [
  { value: 5, label: "5 questions" },
  { value: 10, label: "10 questions" },
  { value: 15, label: "15 questions" },
  { value: 20, label: "20 questions" },
  { value: 25, label: "25 questions" },
  { value: 30, label: "30 questions" },
];

export const TIMER_OPTIONS = [
  { value: 5, label: "5 seconds" },
  { value: 10, label: "10 seconds" },
  { value: 15, label: "15 seconds" },
  { value: 20, label: "20 seconds" },
  { value: 25, label: "25 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 45, label: "45 seconds" },
  { value: 60, label: "60 seconds" },
];

export const LANGUAGE_OPTIONS: { value: string; label: string; flag: string }[] = [
  { value: "english", label: "English", flag: "gb" },
  { value: "spanish", label: "Spanish", flag: "es" },
  { value: "french", label: "French", flag: "fr" },
  { value: "german", label: "German", flag: "de" },
  { value: "italian", label: "Italian", flag: "it" },
  { value: "portuguese", label: "Portuguese", flag: "pt" },
  { value: "dutch", label: "Dutch", flag: "nl" },
  { value: "polish", label: "Polish", flag: "pl" },
  { value: "russian", label: "Russian", flag: "ru" },
  { value: "japanese", label: "Japanese", flag: "jp" },
  { value: "korean", label: "Korean", flag: "kr" },
  { value: "chinese", label: "Chinese", flag: "cn" },
  { value: "arabic", label: "Arabic", flag: "sa" },
  { value: "hindi", label: "Hindi", flag: "in" },
  { value: "turkish", label: "Turkish", flag: "tr" },
  { value: "swedish", label: "Swedish", flag: "se" },
  { value: "norwegian", label: "Norwegian", flag: "no" },
  { value: "danish", label: "Danish", flag: "dk" },
  { value: "finnish", label: "Finnish", flag: "fi" },
  { value: "greek", label: "Greek", flag: "gr" },
];

/**
 * Get flag URL from flagpedia.net
 */
export function getFlagUrl(countryCode: string, size: "w20" | "w40" | "w80" | "w160" = "w40"): string {
  return `https://flagcdn.com/${size}/${countryCode}.png`;
}
