/**
 * Table question driver
 * Fetches multiple choice questions from QuestionsTable
 */

import { QuestionsTable } from "../../tables/questions-table";
import {
  type CategoryDriver,
  type Difficulty,
  type Question,
  shuffleArray,
} from "./types";

/**
 * Create a driver for QuestionsTable-based categories
 */
export function createTableDriver(
  categoryValue: string,
  categoryLabel: string,
  tableCategories: string[],
  fetchCategoryCounts: () => Promise<Record<string, number>>
): CategoryDriver {
  return {
    category: categoryValue,
    fetch: async (
      count: number,
      difficulties: Difficulty[],
      timerSeconds: number
    ): Promise<Question[]> => {
      try {
        // Fetch more than needed to filter by difficulty
        const batchSize = Math.max(100, count * 3);

        const maxOffset = await QuestionsTable.findRows({
          filter: {
            category: { $in: tableCategories },
            difficulty: { $in: difficulties },
          },
          group: {
            question: ["count"],
          },
          orderBy: "id",
          orderDirection: "desc",
          limit: 1,
        }).then((res) => res.rows?.[0].questionCount || 0);

        const offset = Math.max(
          0,
          Math.floor(Math.random() * (maxOffset - batchSize))
        );

        const result = await QuestionsTable.findRows({
          filter: {
            category: { $in: tableCategories },
            difficulty: { $in: difficulties },
          },
          limit: batchSize,
          offset,
        });

        let questions = result.rows;

        // Shuffle and select
        const shuffled = shuffleArray(questions);
        const selected = shuffled.slice(0, count);

        // Transform to Question format
        return selected.map((q) => {
          const allOptions = shuffleArray([
            q.correct_answer,
            ...q.incorrect_answers,
          ]);
          return {
            text: q.question,
            type: "multiple_choice" as const,
            correctAnswer: q.correct_answer,
            options: allOptions,
            category: categoryLabel,
            difficulty: q.difficulty as Difficulty,
            timerSeconds, // Table questions are always multiple choice
          };
        });
      } catch (error) {
        console.error(`[TableDriver:${categoryValue}] Failed to fetch:`, error);
        return [];
      }
    },
  };
}
