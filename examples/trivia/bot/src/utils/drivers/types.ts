/**
 * Shared types for question drivers
 */

export type Difficulty = "easy" | "medium" | "hard";

/**
 * Question structure used throughout the game
 */
export interface Question {
  text: string;
  type: "multiple_choice" | "text_input" | "map_country" | "flag_country";
  correctAnswer: string;
  options?: string[];
  category: string;
  difficulty: Difficulty;
  timerSeconds?: number;
  mapData?: {
    countryCode: string;
    countryAlpha3: string;
    center: [number, number];
    zoom: number;
  };
  flagData?: {
    countryCode: string;
    flagUrl: string;
  };
}

/**
 * Category driver interface - each driver knows how to fetch questions for a category
 */
export interface CategoryDriver {
  category: string;
  fetch: (count: number, difficulties: Difficulty[], timerSeconds: number) => Promise<Question[]>;
}

export const TEXT_INPUT_EXTRA_SECONDS = 5;

/**
 * Get timer seconds based on question type
 * Questions with choices get the base timer, typing questions get +5s
 */
export function getTimerForQuestion(hasOptions: boolean, baseTimer: number): number {
  return hasOptions ? baseTimer : baseTimer + TEXT_INPUT_EXTRA_SECONDS;
}

/**
 * Pick a random difficulty from the provided array
 */
export function pickRandomDifficulty(difficulties: Difficulty[]): Difficulty {
  if (difficulties.length === 0) {
    return "medium";
  }
  return difficulties[Math.floor(Math.random() * difficulties.length)];
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
