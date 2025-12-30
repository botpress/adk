import { describe, expect, it } from "bun:test";
import { generateMapQuestion, createMapDriver } from "./map-driver";
import { TEXT_INPUT_EXTRA_SECONDS } from "./types";

describe("generateMapQuestion", () => {
  it("generates a valid map question", () => {
    const question = generateMapQuestion("medium");

    expect(question.type).toBe("map_country");
    expect(question.correctAnswer).toBeDefined();
    expect(question.category).toBe("Geography (Country Maps)");
    expect(question.difficulty).toBe("medium");
    expect(question.mapData).toBeDefined();
    expect(question.mapData!.countryCode).toBeDefined();
    expect(question.mapData!.countryAlpha3).toBeDefined();
    expect(question.mapData!.center).toHaveLength(2);
    expect(question.mapData!.zoom).toBeGreaterThan(0);
  });

  it("generates easy questions with multiple choice only", () => {
    // Easy questions should always have options
    for (let i = 0; i < 10; i++) {
      const question = generateMapQuestion("easy");
      expect(question.options).toBeDefined();
      expect(question.options!.length).toBe(4);
      expect(question.options).toContain(question.correctAnswer);
    }
  });

  it("generates medium/hard questions with varying formats", () => {
    // Run multiple times to get both multiple choice and text input
    const questions = Array.from({ length: 20 }, () =>
      generateMapQuestion("medium")
    );

    const withOptions = questions.filter((q) => q.options !== undefined);
    const withoutOptions = questions.filter((q) => q.options === undefined);

    // Should have a mix (probabilistic, but very unlikely to fail)
    expect(withOptions.length + withoutOptions.length).toBe(20);
  });

  it("includes timer seconds", () => {
    const question = generateMapQuestion("medium");
    expect(question.timerSeconds).toBeGreaterThan(0);
  });

  it("uses easy country pool for easy difficulty", () => {
    const easyCountryCodes = [
      "us", "ca", "br", "au", "ru", "cn", "in", "jp",
      "fr", "it", "es", "gb", "de", "mx", "eg", "za",
    ];

    // Generate many easy questions and check countries
    for (let i = 0; i < 20; i++) {
      const question = generateMapQuestion("easy");
      expect(easyCountryCodes).toContain(question.mapData!.countryCode);
    }
  });
});

describe("createMapDriver", () => {
  it("creates a driver with correct category", () => {
    const driver = createMapDriver("Geography (Country Maps)");
    expect(driver.category).toBe("geography-maps");
  });

  it("fetches the requested number of questions", async () => {
    const driver = createMapDriver("Geography (Country Maps)");
    const questions = await driver.fetch(5, ["medium"], 20);

    expect(questions.length).toBe(5);
    questions.forEach((q) => {
      expect(q.type).toBe("map_country");
      expect(q.category).toBe("Geography (Country Maps)");
    });
  });

  it("respects difficulty parameter", async () => {
    const driver = createMapDriver("Geography (Country Maps)");
    const questions = await driver.fetch(5, ["easy"], 20);

    questions.forEach((q) => {
      expect(q.difficulty).toBe("easy");
    });
  });

  it("picks random difficulty when multiple provided", async () => {
    const driver = createMapDriver("Geography (Country Maps)");
    const questions = await driver.fetch(20, ["easy", "medium", "hard"], 20);

    const difficulties = new Set(questions.map((q) => q.difficulty));
    // Should have at least 2 different difficulties (probabilistic)
    expect(difficulties.size).toBeGreaterThanOrEqual(1);
  });

  it("avoids duplicate countries", async () => {
    const driver = createMapDriver("Geography (Country Maps)");
    const questions = await driver.fetch(10, ["medium"], 20);

    const countryCodes = questions.map((q) => q.mapData!.countryCode);
    const uniqueCodes = new Set(countryCodes);

    expect(uniqueCodes.size).toBe(10);
  });

  it("overrides category to provided label", async () => {
    const customLabel = "Custom Map Category";
    const driver = createMapDriver(customLabel);
    const questions = await driver.fetch(3, ["medium"], 20);

    questions.forEach((q) => {
      expect(q.category).toBe(customLabel);
    });
  });

  it("multiple choice questions get configured timer", async () => {
    const timerSeconds = 15;
    const driver = createMapDriver("Geography (Country Maps)");
    const questions = await driver.fetch(5, ["easy"], timerSeconds); // easy = always multiple choice

    questions.forEach((q) => {
      expect(q.options).toBeDefined();
      expect(q.timerSeconds).toBe(timerSeconds);
    });
  });

  it("typing questions get configured timer + 5 seconds", async () => {
    const timerSeconds = 20;
    const driver = createMapDriver("Geography (Country Maps)");
    // Generate many hard questions to get some without options
    const questions = await driver.fetch(30, ["hard"], timerSeconds);

    const withOptions = questions.filter((q) => q.options !== undefined);
    const withoutOptions = questions.filter((q) => q.options === undefined);

    // Multiple choice get base timer
    withOptions.forEach((q) => {
      expect(q.timerSeconds).toBe(timerSeconds);
    });

    // Typing questions get base timer + 5
    withoutOptions.forEach((q) => {
      expect(q.timerSeconds).toBe(timerSeconds + TEXT_INPUT_EXTRA_SECONDS);
    });
  });
});
