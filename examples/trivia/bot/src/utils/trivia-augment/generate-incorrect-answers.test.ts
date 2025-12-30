import { describe, expect, it } from "bun:test";
import { adk, z } from "@botpress/runtime";
import { generateIncorrectAnswers } from "./generate-incorrect-answers";

describe("generateIncorrectAnswers", () => {
  it("generates exactly 3 incorrect answers for a geography question", async () => {
    const incorrectAnswers = await generateIncorrectAnswers(
      "What is the capital of Japan?",
      "Geography",
      "Tokyo",
      "easy"
    );

    // Use Zai to validate that the answers are plausible but incorrect
    const validation = await adk.zai.extract(
      `Question: "What is the capital of Japan?"
       Correct answer: "Tokyo"
       Generated incorrect answers: ${JSON.stringify(incorrectAnswers)}

       Evaluate if these incorrect answers are:
       1. All different from the correct answer "Tokyo"
       2. Plausible answers (real cities or capitals)
       3. Related to the question topic (geography/capitals)`,
      z.object({
        allDifferentFromCorrect: z
          .boolean()
          .describe("None of the answers are 'Tokyo'"),
        allPlausible: z
          .boolean()
          .describe("All answers are real cities or plausible capitals"),
        allRelevant: z
          .boolean()
          .describe("All answers are relevant to geography/capitals"),
      })
    );

    expect(validation.allDifferentFromCorrect).toBe(true);
    expect(validation.allPlausible).toBe(true);
    expect(validation.allRelevant).toBe(true);
  });

  it("generates exactly 3 incorrect answers for a science question", async () => {
    const incorrectAnswers = await generateIncorrectAnswers(
      "What planet is known as the Red Planet?",
      "Science",
      "Mars",
      "medium"
    );

    expect(incorrectAnswers).toHaveLength(3);

    // Use Zai to validate that the answers make sense
    const validation = await adk.zai.extract(
      `Question: "What planet is known as the Red Planet?"
       Correct answer: "Mars"
       Generated incorrect answers: ${JSON.stringify(incorrectAnswers)}

       Evaluate if these incorrect answers are:
       1. All different from the correct answer "Mars"
       2. Plausible answers (real planets or celestial bodies)
       3. Not obviously absurd (e.g., not random words)`,
      z.object({
        allDifferentFromCorrect: z
          .boolean()
          .describe("None of the answers are 'Mars'"),
        allPlausible: z
          .boolean()
          .describe("All answers are real planets or celestial bodies"),
        notAbsurd: z
          .boolean()
          .describe("None of the answers are obviously absurd or random"),
      })
    );

    expect(validation.allDifferentFromCorrect).toBe(true);
    expect(validation.allPlausible).toBe(true);
    expect(validation.notAbsurd).toBe(true);
  });

  it("generates plausible hard-difficulty incorrect answers", async () => {
    const incorrectAnswers = await generateIncorrectAnswers(
      "In which year did the Berlin Wall fall?",
      "History",
      "1989",
      "hard"
    );

    expect(incorrectAnswers).toHaveLength(3);

    // Use Zai to validate that hard answers are tricky but still incorrect
    const validation = await adk.zai.extract(
      `Question: "In which year did the Berlin Wall fall?"
       Correct answer: "1989"
       Generated incorrect answers: ${JSON.stringify(incorrectAnswers)}

       For hard difficulty, evaluate if these incorrect answers are:
       1. All different from the correct answer "1989"
       2. Plausible years (not absurd like "42" or "3000")
       3. Close enough to be tricky (within a reasonable historical range)`,
      z.object({
        allDifferentFromCorrect: z
          .boolean()
          .describe("None of the answers are '1989'"),
        allPlausibleYears: z
          .boolean()
          .describe("All answers are plausible years in recent history"),
        reasonablyTricky: z
          .boolean()
          .describe(
            "Answers are close enough to the correct year to be challenging"
          ),
      })
    );

    expect(validation.allDifferentFromCorrect).toBe(true);
    expect(validation.allPlausibleYears).toBe(true);
    expect(validation.reasonablyTricky).toBe(true);
  });
});
