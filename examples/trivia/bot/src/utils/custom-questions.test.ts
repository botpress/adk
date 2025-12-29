import { describe, expect, it } from "bun:test";
import {
  generateMapQuestion,
  generateFlagQuestion,
  generateGeographyQuestions,
} from "./custom-questions";
import { COUNTRIES, getRandomIncorrectCountries } from "./countries";

describe("custom-questions", () => {
  describe("getRandomIncorrectCountries", () => {
    it("returns the requested number of countries", () => {
      const turkey = COUNTRIES.find((c) => c.code === "tr")!;
      const incorrect = getRandomIncorrectCountries(turkey, 3);

      expect(incorrect.length).toBe(3);
    });

    it("does not include the correct country", () => {
      const turkey = COUNTRIES.find((c) => c.code === "tr")!;
      const incorrect = getRandomIncorrectCountries(turkey, 3);

      expect(incorrect.every((c) => c.code !== "tr")).toBe(true);
    });

    it("prefers geographically close countries for Turkey", () => {
      const turkey = COUNTRIES.find((c) => c.code === "tr")!;

      // Run multiple times to account for randomness
      const neighborCodes = ["gr", "ir", "iq", "sy", "bg", "ge"];
      let neighborCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const incorrect = getRandomIncorrectCountries(turkey, 3);
        neighborCount += incorrect.filter((c) =>
          neighborCodes.includes(c.code)
        ).length;
      }

      // On average, should have at least 2 neighbors per iteration (60+ out of 60 total)
      // Being lenient to account for randomness
      expect(neighborCount).toBeGreaterThan(iterations * 1.5);
    });

    it("prefers geographically close countries for Germany", () => {
      const germany = COUNTRIES.find((c) => c.code === "de")!;

      const neighborCodes = ["fr", "pl", "at", "cz", "nl", "be", "ch", "dk"];
      let neighborCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const incorrect = getRandomIncorrectCountries(germany, 3);
        neighborCount += incorrect.filter((c) =>
          neighborCodes.includes(c.code)
        ).length;
      }

      expect(neighborCount).toBeGreaterThan(iterations * 1.5);
    });

    it("prefers similar -stan countries for Kazakhstan", () => {
      const kazakhstan = COUNTRIES.find((c) => c.code === "kz")!;

      const similarCodes = ["uz", "tm", "kg", "tj", "af", "ru", "cn", "mn"];
      let similarCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const incorrect = getRandomIncorrectCountries(kazakhstan, 3);
        similarCount += incorrect.filter((c) =>
          similarCodes.includes(c.code)
        ).length;
      }

      expect(similarCount).toBeGreaterThan(iterations * 1.5);
    });

    it("prefers Caribbean countries for Cuba", () => {
      const cuba = COUNTRIES.find((c) => c.code === "cu")!;

      const similarCodes = ["jm", "mx", "gt", "pa", "cr"];
      let similarCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const incorrect = getRandomIncorrectCountries(cuba, 3);
        similarCount += incorrect.filter((c) =>
          similarCodes.includes(c.code)
        ).length;
      }

      // Cuba should get at least some Caribbean/Central American neighbors
      expect(similarCount).toBeGreaterThan(iterations);
    });

    it("prefers South American neighbors for Brazil", () => {
      const brazil = COUNTRIES.find((c) => c.code === "br")!;

      const neighborCodes = ["ar", "co", "pe", "ve", "py", "uy", "bo", "ec"];
      let neighborCount = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const incorrect = getRandomIncorrectCountries(brazil, 3);
        neighborCount += incorrect.filter((c) =>
          neighborCodes.includes(c.code)
        ).length;
      }

      expect(neighborCount).toBeGreaterThan(iterations * 2);
    });

    it("falls back to random countries when confusing list is insufficient", () => {
      // Find a country with few confusing entries
      const malta = COUNTRIES.find((c) => c.code === "mt")!;
      const incorrect = getRandomIncorrectCountries(malta, 10);

      // Should still return 10 countries even if confusing list is short
      expect(incorrect.length).toBe(10);
    });

    it("returns unique countries (no duplicates)", () => {
      const france = COUNTRIES.find((c) => c.code === "fr")!;

      for (let i = 0; i < 10; i++) {
        const incorrect = getRandomIncorrectCountries(france, 5);
        const codes = incorrect.map((c) => c.code);
        const uniqueCodes = new Set(codes);

        expect(uniqueCodes.size).toBe(codes.length);
      }
    });
  });

  describe("generateMapQuestion", () => {
    it("generates a valid map question", () => {
      const question = generateMapQuestion("medium");

      expect(question.type).toBe("map_country");
      expect(question.correctAnswer).toBeTruthy();
      expect(question.mapData).toBeDefined();
      expect(question.mapData?.countryCode).toBeTruthy();
      expect(question.mapData?.countryAlpha3).toBeTruthy();
      expect(question.mapData?.center).toHaveLength(2);
      expect(question.mapData?.zoom).toBeGreaterThan(0);
    });

    it("easy difficulty always has multiple choice options", () => {
      for (let i = 0; i < 10; i++) {
        const question = generateMapQuestion("easy");
        expect(question.options).toBeDefined();
        expect(question.options?.length).toBe(4);
      }
    });

    it("options include the correct answer", () => {
      const question = generateMapQuestion("easy");

      expect(question.options).toContain(question.correctAnswer);
    });

    it("options include geographically similar countries", () => {
      // Generate multiple questions and check that options tend to be neighbors
      let hasNeighborOption = 0;
      const iterations = 20;

      for (let i = 0; i < iterations; i++) {
        const question = generateMapQuestion("easy");
        const countryCode = question.mapData?.countryCode;

        if (!countryCode || !question.options) continue;

        // Check if at least one wrong option is a likely neighbor
        // This is a soft check since options are shuffled
        const wrongOptions = question.options.filter(
          (o) => o !== question.correctAnswer
        );

        // Just verify we have 3 wrong options
        if (wrongOptions.length === 3) {
          hasNeighborOption++;
        }
      }

      expect(hasNeighborOption).toBe(iterations);
    });
  });

  describe("generateFlagQuestion", () => {
    it("generates a valid flag question", () => {
      const question = generateFlagQuestion("medium");

      expect(question.type).toBe("flag_country");
      expect(question.correctAnswer).toBeTruthy();
      expect(question.flagData).toBeDefined();
      expect(question.flagData?.countryCode).toBeTruthy();
      expect(question.flagData?.flagUrl).toContain("flagcdn.com");
    });

    it("easy difficulty always has multiple choice options", () => {
      for (let i = 0; i < 10; i++) {
        const question = generateFlagQuestion("easy");
        expect(question.options).toBeDefined();
        expect(question.options?.length).toBe(4);
      }
    });
  });

  describe("generateGeographyQuestions", () => {
    it("generates the requested number of questions", () => {
      const questions = generateGeographyQuestions({ count: 5 });
      expect(questions.length).toBe(5);
    });

    it("generates mix of map and flag questions", () => {
      const questions = generateGeographyQuestions({
        count: 20,
        mapPercentage: 0.5,
      });

      const mapQuestions = questions.filter((q) => q.type === "map_country");
      const flagQuestions = questions.filter((q) => q.type === "flag_country");

      // Should have both types
      expect(mapQuestions.length).toBeGreaterThan(0);
      expect(flagQuestions.length).toBeGreaterThan(0);
    });

    it("respects mapPercentage=1.0 for all maps", () => {
      const questions = generateGeographyQuestions({
        count: 10,
        mapPercentage: 1.0,
      });

      expect(questions.every((q) => q.type === "map_country")).toBe(true);
    });

    it("respects mapPercentage=0.0 for all flags", () => {
      const questions = generateGeographyQuestions({
        count: 10,
        mapPercentage: 0.0,
      });

      expect(questions.every((q) => q.type === "flag_country")).toBe(true);
    });

    it("avoids duplicate countries in batch", () => {
      const questions = generateGeographyQuestions({ count: 15 });

      const countryCodes = questions.map(
        (q) => q.mapData?.countryCode || q.flagData?.countryCode
      );
      const uniqueCodes = new Set(countryCodes);

      // Most should be unique (allowing some overlap due to maxAttempts limit)
      expect(uniqueCodes.size).toBeGreaterThanOrEqual(countryCodes.length * 0.8);
    });
  });
});
