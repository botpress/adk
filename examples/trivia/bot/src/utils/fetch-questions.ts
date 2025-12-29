/**
 * Question fetching utility
 * Handles mixing traditional Open Trivia DB questions with custom geography (maps & flags) questions
 *
 * Strategy: Fetch a large batch (50) from Open Trivia DB in ONE API call to avoid rate limits,
 * then filter locally based on user's selected categories and difficulties.
 */

import type { Question } from "./open-trivia-api";
import type { CustomQuestion } from "./custom-questions";

export type { Question };

export type Difficulty = "easy" | "medium" | "hard";

export interface FetchQuestionsSettings {
  questionCount: number;
  categories: string[];
  /** Array of difficulties to include. If multiple, questions will be mixed from each. */
  difficulties: Difficulty[];
}

export interface FetchQuestionsOptions {
  settings: FetchQuestionsSettings;
  // Dependency injection for testing
  fetchTriviaQuestions?: (opts: {
    count: number;
    category?: string;
    difficulty?: Difficulty;
  }) => Promise<Question[]>;
  generateGeographyQuestions?: (opts: {
    count: number;
    difficulty?: Difficulty;
    mapPercentage?: number;
  }) => CustomQuestion[];
  shuffleArray?: <T>(array: T[]) => T[];
  /** Retry delay in ms (default: 5000). Set to 0 for tests. */
  retryDelayMs?: number;
}

/**
 * Pick a random difficulty from the provided array
 */
export function pickRandomDifficulty(difficulties: Difficulty[]): Difficulty {
  if (difficulties.length === 0) {
    return "medium"; // fallback
  }
  return difficulties[Math.floor(Math.random() * difficulties.length)];
}

// Geography category identifiers
const GEO_CATEGORIES = ["geography", "geography-maps", "geography-flags"];

// Batch size for fetching from Open Trivia DB (larger = more to filter from, but slower)
const TRIVIA_BATCH_SIZE = 50;

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Default shuffle using Fisher-Yates algorithm
 */
function defaultShuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Determine map percentage based on selected geography categories
 */
export function calculateMapPercentage(geoCategories: string[]): number {
  const hasGeneral = geoCategories.includes("geography");
  const hasMaps = geoCategories.includes("geography-maps");
  const hasFlags = geoCategories.includes("geography-flags");

  // Maps only
  if (hasMaps && !hasFlags && !hasGeneral) {
    return 1.0;
  }
  // Flags only
  if (hasFlags && !hasMaps && !hasGeneral) {
    return 0.0;
  }
  // Default mix (50/50)
  return 0.5;
}

/**
 * Check if a category is a geography category
 */
export function isGeographyCategory(category: string): boolean {
  return GEO_CATEGORIES.includes(category.toLowerCase());
}

/**
 * Separate categories into geography and trivia categories
 */
export function separateCategories(categories: string[]): {
  geoCategories: string[];
  triviaCategories: string[];
} {
  const lowerCategories = categories.map((c) => c.toLowerCase());

  const geoCategories = lowerCategories.filter((c) => isGeographyCategory(c));
  const triviaCategories = lowerCategories.filter(
    (c) => !isGeographyCategory(c)
  );

  return { geoCategories, triviaCategories };
}

/**
 * Map our category names to Open Trivia DB category names
 */
const CATEGORY_NAME_MAP: Record<string, string[]> = {
  general: ["General Knowledge"],
  science: ["Science & Nature", "Science: Computers", "Science: Mathematics", "Science: Gadgets"],
  history: ["History"],
  entertainment: ["Entertainment: Film", "Entertainment: Music", "Entertainment: Television", "Entertainment: Video Games", "Entertainment: Board Games", "Entertainment: Books", "Entertainment: Musicals & Theatres", "Entertainment: Comics", "Entertainment: Japanese Anime & Manga", "Entertainment: Cartoon & Animations"],
  sports: ["Sports"],
  art: ["Art", "Entertainment: Books"],
  geography: ["Geography"],
};

/**
 * Check if a question matches the user's selected categories
 */
function questionMatchesCategories(question: Question, categories: string[]): boolean {
  if (categories.includes("any")) {
    return true;
  }

  const questionCategory = question.category?.toLowerCase() || "";

  for (const userCategory of categories) {
    const mappedNames = CATEGORY_NAME_MAP[userCategory.toLowerCase()];
    if (mappedNames) {
      for (const name of mappedNames) {
        if (questionCategory.includes(name.toLowerCase())) {
          return true;
        }
      }
    }
    // Also do a direct substring match
    if (questionCategory.includes(userCategory.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a question matches the user's selected difficulties
 */
function questionMatchesDifficulty(question: Question, difficulties: Difficulty[]): boolean {
  if (!question.difficulty) {
    return true; // No difficulty info, include it
  }
  return difficulties.includes(question.difficulty as Difficulty);
}

/**
 * Fetch and combine questions from multiple sources based on selected categories
 *
 * Strategy:
 * 1. Fetch a large batch (50) from Open Trivia DB in ONE API call to avoid rate limits
 * 2. Filter locally based on user's selected categories and difficulties
 * 3. Fill any remaining slots with geography questions (generated locally, no API needed)
 */
export async function fetchQuestions(
  options: FetchQuestionsOptions
): Promise<Question[]> {
  const { settings } = options;

  // Use injected dependencies or import defaults lazily
  const shuffle = options.shuffleArray ?? defaultShuffleArray;
  const retryDelay = options.retryDelayMs ?? RETRY_DELAY_MS;

  // Lazy imports for default implementations
  const fetchTrivia =
    options.fetchTriviaQuestions ??
    (await import("./open-trivia-api")).fetchTriviaQuestions;
  const generateGeo =
    options.generateGeographyQuestions ??
    (await import("./custom-questions")).generateGeographyQuestions;

  const categories = settings.categories.map((c) => c.toLowerCase());
  const totalCount = settings.questionCount;

  // Separate geography categories from trivia categories
  const { geoCategories, triviaCategories } = separateCategories(categories);

  // Calculate how many questions should come from trivia vs geography
  const hasAnyCategory = categories.includes("any");
  const hasOnlyGeoCategories = triviaCategories.length === 0 && geoCategories.length > 0 && !hasAnyCategory;
  const hasOnlyTriviaCategories = geoCategories.length === 0 && triviaCategories.length > 0 && !hasAnyCategory;

  let targetTriviaCount: number;
  let targetGeoCount: number;

  if (hasAnyCategory) {
    // "Any" category: 70% trivia, 30% geography
    targetTriviaCount = Math.ceil(totalCount * 0.7);
    targetGeoCount = totalCount - targetTriviaCount;
  } else if (hasOnlyGeoCategories) {
    // Only geography categories selected (maps/flags/geography)
    targetTriviaCount = geoCategories.includes("geography") ? Math.ceil(totalCount / 2) : 0;
    targetGeoCount = totalCount - targetTriviaCount;
  } else if (hasOnlyTriviaCategories) {
    // Only trivia categories selected
    targetTriviaCount = totalCount;
    targetGeoCount = 0;
  } else {
    // Mixed categories: proportional split
    const geoRatio = geoCategories.length / categories.length;
    targetGeoCount = Math.ceil(totalCount * geoRatio);
    targetTriviaCount = totalCount - targetGeoCount;

    // If geography is in geo categories, half of geo count comes from trivia API
    if (geoCategories.includes("geography")) {
      const triviaGeoCount = Math.ceil(targetGeoCount / 2);
      targetTriviaCount += triviaGeoCount;
      targetGeoCount -= triviaGeoCount;
    }
  }

  const allQuestions: Question[] = [];

  // Step 1: Fetch trivia questions (single batch to avoid rate limits, with retry)
  if (targetTriviaCount > 0) {
    const batchSize = Math.max(TRIVIA_BATCH_SIZE, targetTriviaCount * 2);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Wait before retry attempts (not on first attempt)
        if (attempt > 1 && retryDelay > 0) {
          console.log(`[fetchQuestions] Waiting ${retryDelay / 1000}s before retry attempt ${attempt}...`);
          await sleep(retryDelay);
        }

        console.log(`[fetchQuestions] Fetching ${batchSize} trivia questions (attempt ${attempt}/${MAX_RETRIES})`);

        const batch = await fetchTrivia({
          count: batchSize,
          category: "any", // Fetch from all categories, filter locally
          difficulty: undefined, // Fetch all difficulties, filter locally
        });

        // Filter by user's selected categories and difficulties
        let filtered = batch;

        // Filter by categories (unless "any" is selected)
        if (!categories.includes("any")) {
          filtered = filtered.filter((q) => questionMatchesCategories(q, categories));
        }

        // Filter by difficulties
        filtered = filtered.filter((q) => questionMatchesDifficulty(q, settings.difficulties));

        // Shuffle and take what we need
        const shuffledFiltered = shuffle(filtered);
        allQuestions.push(...shuffledFiltered.slice(0, targetTriviaCount));

        console.log(`[fetchQuestions] Got ${allQuestions.length}/${targetTriviaCount} trivia questions after filtering`);
        break; // Success, exit retry loop
      } catch (error) {
        console.error(`[fetchQuestions] Attempt ${attempt}/${MAX_RETRIES} failed:`, error);
        if (attempt === MAX_RETRIES) {
          console.error("[fetchQuestions] All retry attempts exhausted, falling back to geography questions");
        }
      }
    }
  }

  // Step 2: Generate geography questions
  if (targetGeoCount > 0 || allQuestions.length < totalCount) {
    const geoNeeded = Math.max(targetGeoCount, totalCount - allQuestions.length);
    const mapPercentage = calculateMapPercentage(geoCategories);

    console.log(`[fetchQuestions] Generating ${geoNeeded} geography questions`);

    for (let i = 0; i < geoNeeded; i++) {
      const difficulty = pickRandomDifficulty(settings.difficulties);
      const generated = generateGeo({
        count: 1,
        difficulty,
        mapPercentage,
      });
      allQuestions.push(...(generated as Question[]));
    }
  }

  // Step 3: If still short, generate more geography questions to fill the gap
  if (allQuestions.length < totalCount) {
    const stillNeeded = totalCount - allQuestions.length;
    console.log(`[fetchQuestions] Still short, generating ${stillNeeded} more geography questions`);

    for (let i = 0; i < stillNeeded; i++) {
      const difficulty = pickRandomDifficulty(settings.difficulties);
      const generated = generateGeo({
        count: 1,
        difficulty,
        mapPercentage: 0.5,
      });
      allQuestions.push(...(generated as Question[]));
    }
  }

  // Shuffle all questions together
  const shuffled = shuffle(allQuestions);

  // Trim to exact count requested
  return shuffled.slice(0, totalCount);
}
