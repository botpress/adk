import { describe, expect, it } from "bun:test";
import { rateQuestionDifficulty } from "./rate-question-difficulty";

describe("rateQuestionDifficulty", () => {
  it("rates an easy question as easy", async () => {
    const difficulty = await rateQuestionDifficulty(
      "What color is the sky on a clear day?",
      "General",
      "Blue"
    );

    expect(["easy"]).toContain(difficulty);
  });

  it("rates a hard question appropriately", async () => {
    const difficulty = await rateQuestionDifficulty(
      "What is the capital of Burkina Faso?",
      "Geography",
      "Ouagadougou"
    );

    expect(["medium", "hard"]).toContain(difficulty);
  });

  it("returns a valid difficulty level", async () => {
    const difficulty = await rateQuestionDifficulty(
      "Who painted the Mona Lisa?",
      "Art",
      "Leonardo da Vinci"
    );

    expect(["easy", "medium"]).toContain(difficulty);
  });

  it("handles a medium difficulty question", async () => {
    const difficulty = await rateQuestionDifficulty(
      "What is the chemical symbol for Gold?",
      "Science",
      "Au"
    );

    expect(["easy", "medium"]).toContain(difficulty);
  });
});
