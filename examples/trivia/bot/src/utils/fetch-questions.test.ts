import { describe, expect, it } from "bun:test";
import {
  CATEGORIES,
  fetchCategories,
  fetchQuestions,
  Question,
} from "./fetch-questions";
import { TEXT_INPUT_EXTRA_SECONDS } from "./drivers";

const roundRobinShuffle = (array: Question[]): Question[] => {
  const result: Question[] = [];
  const len = array.length;
  const typeMap: Record<string, Question[]> = {};

  // Group questions by type
  for (const item of array) {
    if (!typeMap[item.category]) {
      typeMap[item.category] = [];
    }
    typeMap[item.category].push(item);
  }

  const typeKeys = Object.keys(typeMap);
  let index = 0;

  // Round-robin selection
  while (result.length < len) {
    const currentType = typeKeys[index % typeKeys.length];
    const itemsOfType = typeMap[currentType];

    if (itemsOfType.length > 0) {
      result.push(itemsOfType.shift()!);
    }

    index++;
  }

  return result;
};

describe("fetchCategories", () => {
  it("correctly fetches categories from table", async () => {
    const categories = await fetchCategories();
    const sum = Object.values(categories).reduce((a, b) => a + b, 0);
    expect(categories).toBeDefined();
    expect(Object.keys(categories).length).toBeGreaterThan(5);
    expect(categories["Geography"]).toBeGreaterThan(0);
    expect(categories["General"]).toBeGreaterThan(0);
    expect(sum).toBeGreaterThan(10_000);
  });
});

describe("CATEGORIES constant", () => {
  it("has all expected categories", () => {
    expect(CATEGORIES.length).toBe(13);

    const values = CATEGORIES.map((c) => c.value);
    expect(values).toContain("general");
    expect(values).toContain("geography");
    expect(values).toContain("geography-maps");
    expect(values).toContain("geography-flags");
  });

  it("has correct driver types", () => {
    const tableCategories = CATEGORIES.filter((c) => c.driver === "table");
    const mapCategories = CATEGORIES.filter((c) => c.driver === "custom-maps");
    const flagCategories = CATEGORIES.filter(
      (c) => c.driver === "custom-flags"
    );

    expect(tableCategories.length).toBe(11);
    expect(mapCategories.length).toBe(1);
    expect(flagCategories.length).toBe(1);

    // Table categories should have tableCategories defined
    for (const cat of tableCategories) {
      expect(cat.tableCategories).toBeDefined();
      expect(cat.tableCategories!.length).toBeGreaterThan(0);
    }
  });
});

describe("fetchQuestions with 'any' category", () => {
  it("expands 'any' to include all categories", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: CATEGORIES.length,
        categories: ["any"],
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(CATEGORIES.length);
    const categorySet = new Set(questions.map((q) => q.category.toLowerCase()));
    expect(categorySet.size).toBe(CATEGORIES.length);
  });

  it("includes multiple question types when shuffled", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 30,
        categories: ["any"],
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },

      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(30);

    // With round-robin shuffle, we should get all question types
    const types = new Set(questions.map((q) => q.type));
    expect(types.has("multiple_choice")).toBe(true);
    expect(types.has("map_country")).toBe(true);
    expect(types.has("flag_country")).toBe(true);
  });
});

describe("fetchQuestions with specific categories", () => {
  it("fetches only from specified table category", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["general"], // general has lots of questions
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(5);

    // All should be multiple choice from table
    for (const q of questions) {
      expect(q.type).toBe("multiple_choice");
      expect(q.options).toBeDefined();
      expect(q.options!.length).toBe(4);
    }
  });

  it("fetches from multiple table categories", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 10,
        categories: ["general", "history"], // use categories with enough questions
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(10);

    // All should be multiple choice
    for (const q of questions) {
      expect(q.type).toBe("multiple_choice");
    }
  });

  it("respects difficulty filter", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["general"],
        difficulties: ["easy"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    // All should be easy difficulty
    for (const q of questions) {
      expect(q.difficulty).toBe("easy");
    }
  });
});

describe("fetchQuestions with maps & flags only", () => {
  it("fetches only map questions when geography-maps selected", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["geography-maps"],
        difficulties: ["medium"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(5);

    for (const q of questions) {
      expect(q.type).toBe("map_country");
      expect(q.mapData).toBeDefined();
      expect(q.mapData!.countryCode).toBeDefined();
    }
  });

  it("fetches only flag questions when geography-flags selected", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["geography-flags"],
        difficulties: ["medium"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(5);

    for (const q of questions) {
      expect(q.type).toBe("flag_country");
      expect(q.flagData).toBeDefined();
      expect(q.flagData!.flagUrl).toBeDefined();
    }
  });

  it("fetches both map and flag questions when both selected", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 10,
        categories: ["geography-maps", "geography-flags"],
        difficulties: ["medium"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(10);

    const mapQuestions = questions.filter((q) => q.type === "map_country");
    const flagQuestions = questions.filter((q) => q.type === "flag_country");

    // Should have both types with round-robin shuffle
    expect(mapQuestions.length).toBeGreaterThan(0);
    expect(flagQuestions.length).toBeGreaterThan(0);
  });
});

describe("fetchQuestions with mixed categories", () => {
  it("fetches from table and custom generators together", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 10,
        categories: ["general", "geography-maps"],
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(10);

    const multipleChoice = questions.filter(
      (q) => q.type === "multiple_choice"
    );
    const mapQuestions = questions.filter((q) => q.type === "map_country");

    // Should have both types with round-robin shuffle
    expect(multipleChoice.length).toBeGreaterThan(0);
    expect(mapQuestions.length).toBeGreaterThan(0);
  });

  it("fetches from table, maps, and flags together", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 15,
        categories: ["general", "geography-maps", "geography-flags"],
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(15);

    const types = new Set(questions.map((q) => q.type));

    // Should have all three types with round-robin shuffle
    expect(types.has("multiple_choice")).toBe(true);
    expect(types.has("map_country")).toBe(true);
    expect(types.has("flag_country")).toBe(true);
  });

  it("handles geography (table) alongside geography-maps and geography-flags", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 15,
        categories: ["geography", "geography-maps", "geography-flags"],
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(15);

    // All should be geography-related and include all three types
    const types = new Set(questions.map((q) => q.type));
    expect(types.has("multiple_choice")).toBe(true);
    expect(types.has("map_country")).toBe(true);
    expect(types.has("flag_country")).toBe(true);
    expect(
      questions.filter((q) => q.difficulty === "easy").length
    ).toBeGreaterThan(0);
    expect(
      questions.filter((q) => q.difficulty === "medium").length
    ).toBeGreaterThan(0);
    expect(
      questions.filter((q) => q.difficulty === "hard").length
    ).toBeGreaterThan(0);
  });
});

describe("fetchQuestions edge cases", () => {
  it("returns empty array for invalid categories", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["nonexistent-category"],
        difficulties: ["medium"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(0);
  });

  it("handles case-insensitive category matching", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["GENERAL", "Geography-Maps"],
        difficulties: ["medium"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(5);
    expect(questions.map((x) => x.difficulty)).toEqual(Array(5).fill("medium"));
  });

  it("limits results to requested questionCount", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 3,
        categories: ["any"],
        difficulties: ["easy", "medium", "hard"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(3);
  });

  it("easy general with high offset", async () => {
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["general"],
        difficulties: ["easy"],
        timerSeconds: 20,
      },
      shuffleArray: roundRobinShuffle,
    });
    expect(questions.length).toBe(5);
    for (const q of questions) {
      expect(q.difficulty).toBe("easy");
    }
  });
});

describe("fetchQuestions timer behavior", () => {
  it("multiple choice questions get configured timer", async () => {
    const timerSeconds = 15;
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["general"], // table questions are always multiple choice
        difficulties: ["easy", "medium", "hard"],
        timerSeconds,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(5);

    // All table questions are multiple choice, so they get the base timer
    for (const q of questions) {
      expect(q.options).toBeDefined();
      expect(q.timerSeconds).toBe(timerSeconds);
    }
  });

  it("easy geography questions (always multiple choice) get configured timer", async () => {
    const timerSeconds = 10;
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["geography-maps", "geography-flags"],
        difficulties: ["easy"], // easy always generates multiple choice
        timerSeconds,
      },
      shuffleArray: roundRobinShuffle,
    });

    expect(questions.length).toBe(5);

    // Easy questions are always multiple choice
    for (const q of questions) {
      expect(q.options).toBeDefined();
      expect(q.timerSeconds).toBe(timerSeconds);
    }
  });

  it("typing questions get configured timer + 5 seconds", async () => {
    const timerSeconds = 20;

    // Generate many medium/hard questions to get some without options
    const questions = await fetchQuestions({
      settings: {
        questionCount: 50,
        categories: ["geography-maps", "geography-flags"],
        difficulties: ["hard"], // hard has 50% chance of text input
        timerSeconds,
      },
      shuffleArray: roundRobinShuffle,
    });

    // Find questions with and without options
    const withOptions = questions.filter((q) => q.options !== undefined);
    const withoutOptions = questions.filter((q) => q.options === undefined);

    // Multiple choice questions get base timer
    for (const q of withOptions) {
      expect(q.timerSeconds).toBe(timerSeconds);
    }

    // Typing questions get base timer + 5
    for (const q of withoutOptions) {
      expect(q.timerSeconds).toBe(timerSeconds + TEXT_INPUT_EXTRA_SECONDS);
    }
  });

  it("respects different timer configurations", async () => {
    const timerSeconds = 30;
    const questions = await fetchQuestions({
      settings: {
        questionCount: 5,
        categories: ["general"],
        difficulties: ["medium"],
        timerSeconds,
      },
      shuffleArray: roundRobinShuffle,
    });

    for (const q of questions) {
      expect(q.timerSeconds).toBe(timerSeconds);
    }
  });
});
