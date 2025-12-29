/**
 * Question fetching utility
 * Handles mixing traditional Open Trivia DB questions with custom geography (maps & flags) questions
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
 * Fetch and combine questions from multiple sources based on selected categories
 *
 * This function handles:
 * - "any" category: fetches from Open Trivia DB + adds maps & flags
 * - Geography categories (geography, geography-maps, geography-flags): custom questions
 * - Other categories: Open Trivia DB
 * - Proper mixing and shuffling of all question types
 */
export async function fetchQuestions(
  options: FetchQuestionsOptions
): Promise<Question[]> {
  const { settings } = options;

  // Use injected dependencies or import defaults lazily
  const shuffle = options.shuffleArray ?? defaultShuffleArray;

  // Lazy imports for default implementations
  const fetchTrivia =
    options.fetchTriviaQuestions ??
    (await import("./open-trivia-api")).fetchTriviaQuestions;
  const generateGeo =
    options.generateGeographyQuestions ??
    (await import("./custom-questions")).generateGeographyQuestions;

  const categories = settings.categories.map((c) => c.toLowerCase());
  const totalCount = settings.questionCount;

  // If "any" is selected, fetch from Open Trivia DB + add geography questions
  if (categories.includes("any")) {
    // Get ~70% from trivia, ~30% from geography (maps + flags)
    const triviaCount = Math.ceil(totalCount * 0.7);
    const geoCount = totalCount - triviaCount;

    // Fetch trivia questions, distributing across difficulties
    const triviaQuestions: Question[] = [];
    const questionsPerDifficulty = Math.ceil(triviaCount / settings.difficulties.length);
    for (const difficulty of settings.difficulties) {
      const count = Math.min(questionsPerDifficulty, triviaCount - triviaQuestions.length);
      if (count <= 0) break;
      const fetched = await fetchTrivia({
        count,
        category: "any",
        difficulty,
      });
      triviaQuestions.push(...fetched);
    }

    // Generate geography questions with random difficulties from the pool
    const geoQuestions: CustomQuestion[] = [];
    for (let i = 0; i < geoCount; i++) {
      const difficulty = pickRandomDifficulty(settings.difficulties);
      const generated = generateGeo({
        count: 1,
        difficulty,
        mapPercentage: 0.5,
      });
      geoQuestions.push(...generated);
    }

    const allQuestions = [...triviaQuestions, ...(geoQuestions as Question[])];
    const shuffled = shuffle(allQuestions);
    return shuffled.slice(0, totalCount);
  }

  // Separate geography categories from trivia categories
  const { geoCategories, triviaCategories } = separateCategories(categories);

  const allQuestions: Question[] = [];

  // Fetch geography questions if any geo category is selected
  if (geoCategories.length > 0) {
    const geoCount =
      triviaCategories.length > 0
        ? Math.ceil(totalCount * (geoCategories.length / categories.length))
        : totalCount;

    // Determine map percentage based on selected geo categories
    const mapPercentage = calculateMapPercentage(geoCategories);

    // If "geography" is selected, also fetch from Open Trivia DB geography
    if (geoCategories.includes("geography")) {
      const triviaGeoCount = Math.ceil(geoCount / 2);
      const customGeoCount = geoCount - triviaGeoCount;

      // Fetch trivia geography questions, distributing across difficulties
      const questionsPerDifficulty = Math.ceil(triviaGeoCount / settings.difficulties.length);
      for (const difficulty of settings.difficulties) {
        const count = Math.min(questionsPerDifficulty, triviaGeoCount - allQuestions.length);
        if (count <= 0) break;
        const fetched = await fetchTrivia({
          count,
          category: "geography",
          difficulty,
        });
        allQuestions.push(...fetched);
      }

      // Generate custom geography questions with random difficulties
      for (let i = 0; i < customGeoCount; i++) {
        const difficulty = pickRandomDifficulty(settings.difficulties);
        const generated = generateGeo({
          count: 1,
          difficulty,
          mapPercentage,
        });
        allQuestions.push(...(generated as Question[]));
      }
    } else {
      // Only maps/flags selected, no trivia geography
      // Generate custom geography questions with random difficulties
      for (let i = 0; i < geoCount; i++) {
        const difficulty = pickRandomDifficulty(settings.difficulties);
        const generated = generateGeo({
          count: 1,
          difficulty,
          mapPercentage,
        });
        allQuestions.push(...(generated as Question[]));
      }
    }
  }

  // Fetch trivia questions for each non-geography category
  if (triviaCategories.length > 0) {
    const triviaCount = totalCount - allQuestions.length;
    const questionsPerCategory = Math.ceil(triviaCount / triviaCategories.length);

    for (const category of triviaCategories) {
      const countForThisCategory = Math.min(
        questionsPerCategory,
        totalCount - allQuestions.length
      );

      if (countForThisCategory <= 0) break;

      // Distribute across difficulties for this category
      const questionsPerDifficulty = Math.ceil(countForThisCategory / settings.difficulties.length);
      let fetchedForCategory = 0;

      for (const difficulty of settings.difficulties) {
        const count = Math.min(
          questionsPerDifficulty,
          countForThisCategory - fetchedForCategory
        );
        if (count <= 0) break;

        try {
          const fetched = await fetchTrivia({
            count,
            category,
            difficulty,
          });
          allQuestions.push(...fetched);
          fetchedForCategory += fetched.length;
        } catch (error) {
          console.error(`[fetchQuestions] Failed to fetch from ${category} (${difficulty})`, error);
        }
      }
    }
  }

  // If we didn't get enough questions, try to fill the gap
  // This can happen when the API doesn't have enough questions for specific category/difficulty combos
  if (allQuestions.length < totalCount) {
    const deficit = totalCount - allQuestions.length;
    console.log(`[fetchQuestions] Got ${allQuestions.length}/${totalCount} questions, fetching ${deficit} more`);

    // First try: fetch from "any" category with a random difficulty from settings
    try {
      const fetched = await fetchTrivia({
        count: deficit,
        category: "any",
        difficulty: pickRandomDifficulty(settings.difficulties),
      });
      allQuestions.push(...fetched);
    } catch (error) {
      console.error("[fetchQuestions] Failed to fetch backfill questions", error);
    }

    // Second try: if still short, generate geography questions to fill the gap
    if (allQuestions.length < totalCount) {
      const stillNeeded = totalCount - allQuestions.length;
      console.log(`[fetchQuestions] Still short, generating ${stillNeeded} geography questions`);
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
  }

  // Shuffle all questions together
  const shuffled = shuffle(allQuestions);

  // Trim to exact count requested
  return shuffled.slice(0, totalCount);
}
