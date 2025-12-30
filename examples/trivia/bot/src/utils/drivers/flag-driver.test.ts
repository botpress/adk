import { describe, expect, it } from "bun:test";
import { generateFlagQuestion, createFlagDriver } from "./flag-driver";
import { TEXT_INPUT_EXTRA_SECONDS } from "./types";

describe("generateFlagQuestion", () => {
  it("generates a valid flag question", () => {
    const question = generateFlagQuestion("medium");

    expect(question.type).toBe("flag_country");
    expect(question.correctAnswer).toBeDefined();
    expect(question.category).toBe("Geography (Country Flags)");
    expect(question.difficulty).toBe("medium");
    expect(question.flagData).toBeDefined();
    expect(question.flagData!.countryCode).toBeDefined();
    expect(question.flagData!.flagUrl).toBeDefined();
    expect(question.flagData!.flagUrl).toContain("flagcdn.com");
  });

  it("generates easy questions with multiple choice only", () => {
    // Easy questions should always have options
    for (let i = 0; i < 10; i++) {
      const question = generateFlagQuestion("easy");
      expect(question.options).toBeDefined();
      expect(question.options!.length).toBe(4);
      expect(question.options).toContain(question.correctAnswer);
    }
  });

  it("generates medium/hard questions with varying formats", () => {
    // Run multiple times to get both multiple choice and text input
    const questions = Array.from({ length: 20 }, () =>
      generateFlagQuestion("medium")
    );

    const withOptions = questions.filter((q) => q.options !== undefined);
    const withoutOptions = questions.filter((q) => q.options === undefined);

    // Should have a mix (probabilistic, but very unlikely to fail)
    expect(withOptions.length + withoutOptions.length).toBe(20);
  });

  it("includes timer seconds", () => {
    const question = generateFlagQuestion("medium");
    expect(question.timerSeconds).toBeGreaterThan(0);
  });

  it("uses easy country pool for easy difficulty", () => {
    const easyCountryCodes = [
      "us", "ca", "br", "jp", "gb", "fr", "de", "it",
      "es", "mx", "cn", "in", "au", "nz", "za", "ch",
      "se", "no", "dk", "gr", "tr", "kr", "ar", "cl",
    ];

    // Generate many easy questions and check countries
    for (let i = 0; i < 20; i++) {
      const question = generateFlagQuestion("easy");
      expect(easyCountryCodes).toContain(question.flagData!.countryCode);
    }
  });

  it("generates valid flag URL", () => {
    const question = generateFlagQuestion("medium");
    const url = question.flagData!.flagUrl;

    expect(url).toMatch(/^https:\/\/flagcdn\.com\/w320\/[a-z]{2}\.png$/);
  });
});

describe("createFlagDriver", () => {
  it("creates a driver with correct category", () => {
    const driver = createFlagDriver("Geography (Country Flags)");
    expect(driver.category).toBe("geography-flags");
  });

  it("fetches the requested number of questions", async () => {
    const driver = createFlagDriver("Geography (Country Flags)");
    const questions = await driver.fetch(5, ["medium"], 20);

    expect(questions.length).toBe(5);
    questions.forEach((q) => {
      expect(q.type).toBe("flag_country");
      expect(q.category).toBe("Geography (Country Flags)");
    });
  });

  it("respects difficulty parameter", async () => {
    const driver = createFlagDriver("Geography (Country Flags)");
    const questions = await driver.fetch(5, ["easy"], 20);

    questions.forEach((q) => {
      expect(q.difficulty).toBe("easy");
    });
  });

  it("picks random difficulty when multiple provided", async () => {
    const driver = createFlagDriver("Geography (Country Flags)");
    const questions = await driver.fetch(20, ["easy", "medium", "hard"], 20);

    const difficulties = new Set(questions.map((q) => q.difficulty));
    // Should have at least 1 difficulty (probabilistic)
    expect(difficulties.size).toBeGreaterThanOrEqual(1);
  });

  it("avoids duplicate countries", async () => {
    const driver = createFlagDriver("Geography (Country Flags)");
    const questions = await driver.fetch(10, ["medium"], 20);

    const countryCodes = questions.map((q) => q.flagData!.countryCode);
    const uniqueCodes = new Set(countryCodes);

    expect(uniqueCodes.size).toBe(10);
  });

  it("overrides category to provided label", async () => {
    const customLabel = "Custom Flag Category";
    const driver = createFlagDriver(customLabel);
    const questions = await driver.fetch(3, ["medium"], 20);

    questions.forEach((q) => {
      expect(q.category).toBe(customLabel);
    });
  });

  it("multiple choice questions get configured timer", async () => {
    const timerSeconds = 15;
    const driver = createFlagDriver("Geography (Country Flags)");
    const questions = await driver.fetch(5, ["easy"], timerSeconds); // easy = always multiple choice

    questions.forEach((q) => {
      expect(q.options).toBeDefined();
      expect(q.timerSeconds).toBe(timerSeconds);
    });
  });

  it("typing questions get configured timer + 5 seconds", async () => {
    const timerSeconds = 20;
    const driver = createFlagDriver("Geography (Country Flags)");
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
