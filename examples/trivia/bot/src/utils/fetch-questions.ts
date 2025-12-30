/**
 * Question fetching utility
 * Fetches questions from QuestionsTable and mixes with custom geography (maps & flags) questions
 *
 * Algorithm for equal category representation:
 * 1. "any" = ALL categories
 * 2. Query X questions from each selected category (where X = total questions desired)
 * 3. Each category has its own "driver" to fetch questions
 * 4. Most questions from QuestionsTable, geography-maps/flags have custom generators
 * 5. Shuffle all questions together, pick first X for the quiz
 */

import { QuestionsTable } from "../tables/questions-table";
import {
  createMapDriver,
  createFlagDriver,
  createTableDriver,
  shuffleArray,
  type CategoryDriver,
  type Difficulty,
  type Question,
} from "./drivers";

export type { Difficulty, Question } from "./drivers";

export interface FetchQuestionsSettings {
  questionCount: number;
  categories: string[];
  difficulties: Difficulty[];
  timerSeconds: number;
}

export interface FetchQuestionsOptions {
  settings: FetchQuestionsSettings;
  shuffleArray?: (array: Question[]) => Question[];
}

/**
 * Official category definitions
 * - label: Display name shown in frontend
 * - driver: How to fetch questions ("table" or "custom-maps" or "custom-flags")
 * - tableCategories: For table driver, which QuestionsTable categories to query
 */
export interface CategoryDefinition {
  value: string;
  label: string;
  driver: "table" | "custom-maps" | "custom-flags";
  tableCategories?: string[];
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    value: "general",
    label: "General Knowledge",
    driver: "table",
    tableCategories: ["General"],
  },
  {
    value: "science",
    label: "Science & Nature",
    driver: "table",
    tableCategories: ["Science & Nature", "Mathematics"],
  },
  {
    value: "history",
    label: "History & Holidays",
    driver: "table",
    tableCategories: ["History & Holidays"],
  },
  {
    value: "entertainment",
    label: "Entertainment & Music",
    driver: "table",
    tableCategories: [
      "Entertainment",
      "Music",
      "Toys & Games",
      "Technology & Video Games",
      "Tech & Video Games",
    ],
  },
  {
    value: "sports",
    label: "Sports & Leisure",
    driver: "table",
    tableCategories: ["Sports & Leisure"],
  },
  {
    value: "art",
    label: "Art & Literature",
    driver: "table",
    tableCategories: ["Art & Literature"],
  },
  {
    value: "geography",
    label: "Geography",
    driver: "table",
    tableCategories: ["Geography"],
  },
  {
    value: "geography-maps",
    label: "Geography (Country Maps)",
    driver: "custom-maps",
  },
  {
    value: "geography-flags",
    label: "Geography (Country Flags)",
    driver: "custom-flags",
  },
  {
    value: "food",
    label: "Food & Drink",
    driver: "table",
    tableCategories: ["Food & Drink"],
  },
  {
    value: "people",
    label: "People & Places",
    driver: "table",
    tableCategories: ["People & Places"],
  },
  {
    value: "religion",
    label: "Religion & Mythology",
    driver: "table",
    tableCategories: ["Religion & Mythology"],
  },
  {
    value: "language",
    label: "Language",
    driver: "table",
    tableCategories: ["Language"],
  },
];

/**
 * Expand "any" to all categories, or return the selected categories
 */
function expandCategories(categories: string[]): CategoryDefinition[] {
  const lowerCategories = categories.map((c) => c.toLowerCase());

  if (lowerCategories.includes("any")) {
    return [...CATEGORIES];
  }

  return [...CATEGORIES].filter((c) => lowerCategories.includes(c.value));
}

// Memoized category counts
let categoriesCache: Record<string, number> | null = null;

/**
 * Fetch category counts from QuestionsTable (memoized)
 */
export async function fetchCategories(): Promise<Record<string, number>> {
  if (categoriesCache) {
    return categoriesCache;
  }

  const result = await QuestionsTable.findRows({
    group: {
      category: ["key", "count"],
    },
  });

  categoriesCache = result.rows
    .map((x) => ({
      ...x,
      category: x.categoryKey || (x as any).category,
    }))
    .reduce(
      (acc, row) => {
        if (
          typeof row.category !== "string" ||
          typeof row.categoryCount !== "number" ||
          row.categoryCount <= 5
        ) {
          return acc;
        }
        acc[row.category] = row.categoryCount;
        return acc;
      },
      {} as Record<string, number>
    );

  return categoriesCache;
}

/**
 * Create drivers for all selected categories
 */
function createDrivers(categories: CategoryDefinition[]): CategoryDriver[] {
  const drivers: CategoryDriver[] = [];

  for (const category of categories) {
    switch (category.driver) {
      case "table":
        if (category.tableCategories) {
          drivers.push(
            createTableDriver(
              category.value,
              category.label,
              category.tableCategories,
              fetchCategories
            )
          );
        }
        break;
      case "custom-maps":
        drivers.push(createMapDriver(category.label));
        break;
      case "custom-flags":
        drivers.push(createFlagDriver(category.label));
        break;
    }
  }

  return drivers;
}

/**
 * Fetch questions from QuestionsTable and combine with geography questions
 *
 * Algorithm:
 * 1. Expand categories (handle "any")
 * 2. Create a driver for each category
 * 3. Fetch X questions from each category (X = total questions desired)
 * 4. Shuffle all questions together
 * 5. Pick the first X questions for the quiz
 */
export async function fetchQuestions(
  options: FetchQuestionsOptions
): Promise<Question[]> {
  const { settings } = options;
  const shuffle = options.shuffleArray ?? shuffleArray;

  const totalCount = settings.questionCount;

  // Step 1: Expand categories
  const expandedCategories = expandCategories(settings.categories);
  if (expandedCategories.length === 0) {
    console.warn("[fetchQuestions] No valid categories selected");
    return [];
  }

  // Step 2: Create drivers for each category
  const drivers = createDrivers(expandedCategories);

  // Step 3: Fetch X questions from each category in parallel
  const fetchPromises = drivers.map((driver) =>
    driver.fetch(totalCount, settings.difficulties, settings.timerSeconds)
  );
  const categoryResults = await Promise.all(fetchPromises);

  // Step 4: Combine all questions into one pool
  const allQuestions = categoryResults.flat();

  // Step 5: Shuffle and pick first X questions
  const shuffled = shuffle(allQuestions);
  const selected = shuffled.slice(0, totalCount);

  return selected;
}
