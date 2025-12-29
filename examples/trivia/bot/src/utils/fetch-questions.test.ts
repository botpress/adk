import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  fetchQuestions,
  calculateMapPercentage,
  isGeographyCategory,
  separateCategories,
  pickRandomDifficulty,
  type Question,
  type Difficulty,
} from "./fetch-questions";
import type { CustomQuestion } from "./custom-questions";

// Timer constants from custom-questions.ts
const BASE_TIMER_SECONDS = 20;
const TEXT_INPUT_EXTRA_SECONDS = 5;

/**
 * Mock question factories
 */
function createMockTriviaQuestion(overrides: Partial<Question> = {}): Question {
  return {
    text: "What is the capital of France?",
    type: "multiple_choice",
    correctAnswer: "Paris",
    options: ["Paris", "London", "Berlin", "Madrid"],
    category: "Geography",
    difficulty: "medium",
    ...overrides,
  };
}

function createMockMapQuestion(overrides: Partial<CustomQuestion> = {}): CustomQuestion {
  return {
    text: "Which country is highlighted on the map?",
    type: "map_country",
    correctAnswer: "France",
    options: ["France", "Germany", "Spain", "Italy"],
    category: "Geography",
    difficulty: "medium",
    timerSeconds: BASE_TIMER_SECONDS,
    mapData: {
      countryCode: "fr",
      countryAlpha3: "FRA",
      center: [2.2137, 46.2276],
      zoom: 4,
    },
    ...overrides,
  };
}

function createMockFlagQuestion(overrides: Partial<CustomQuestion> = {}): CustomQuestion {
  return {
    text: "Which country does this flag belong to?",
    type: "flag_country",
    correctAnswer: "Japan",
    options: ["Japan", "China", "Korea", "Vietnam"],
    category: "Geography",
    difficulty: "medium",
    timerSeconds: BASE_TIMER_SECONDS,
    flagData: {
      countryCode: "jp",
      flagUrl: "https://flagcdn.com/w320/jp.png",
    },
    ...overrides,
  };
}

function createMockTextInputQuestion(overrides: Partial<CustomQuestion> = {}): CustomQuestion {
  return {
    text: "Name the country highlighted on the map:",
    type: "map_country",
    correctAnswer: "Brazil",
    // No options = text input
    category: "Geography",
    difficulty: "hard",
    timerSeconds: BASE_TIMER_SECONDS + TEXT_INPUT_EXTRA_SECONDS,
    mapData: {
      countryCode: "br",
      countryAlpha3: "BRA",
      center: [-51.9253, -14.235],
      zoom: 3,
    },
    ...overrides,
  };
}

describe("fetch-questions utility", () => {
  describe("calculateMapPercentage", () => {
    it("returns 1.0 for maps only", () => {
      expect(calculateMapPercentage(["geography-maps"])).toBe(1.0);
    });

    it("returns 0.0 for flags only", () => {
      expect(calculateMapPercentage(["geography-flags"])).toBe(0.0);
    });

    it("returns 0.5 for mixed geography", () => {
      expect(calculateMapPercentage(["geography"])).toBe(0.5);
      expect(calculateMapPercentage(["geography-maps", "geography-flags"])).toBe(0.5);
      expect(calculateMapPercentage(["geography", "geography-maps"])).toBe(0.5);
    });
  });

  describe("isGeographyCategory", () => {
    it("identifies geography categories", () => {
      expect(isGeographyCategory("geography")).toBe(true);
      expect(isGeographyCategory("geography-maps")).toBe(true);
      expect(isGeographyCategory("geography-flags")).toBe(true);
      expect(isGeographyCategory("GEOGRAPHY")).toBe(true);
    });

    it("rejects non-geography categories", () => {
      expect(isGeographyCategory("general")).toBe(false);
      expect(isGeographyCategory("science")).toBe(false);
      expect(isGeographyCategory("history")).toBe(false);
    });
  });

  describe("pickRandomDifficulty", () => {
    it("returns a difficulty from the provided array", () => {
      const difficulties: Difficulty[] = ["easy", "medium", "hard"];
      for (let i = 0; i < 20; i++) {
        const result = pickRandomDifficulty(difficulties);
        expect(difficulties).toContain(result);
      }
    });

    it("returns medium as fallback for empty array", () => {
      expect(pickRandomDifficulty([])).toBe("medium");
    });

    it("returns the only difficulty when array has one element", () => {
      expect(pickRandomDifficulty(["hard"])).toBe("hard");
      expect(pickRandomDifficulty(["easy"])).toBe("easy");
    });
  });

  describe("separateCategories", () => {
    it("separates geography from trivia categories", () => {
      const result = separateCategories([
        "general",
        "geography",
        "science",
        "geography-maps",
      ]);
      expect(result.geoCategories).toEqual(["geography", "geography-maps"]);
      expect(result.triviaCategories).toEqual(["general", "science"]);
    });

    it("handles all geography categories", () => {
      const result = separateCategories(["geography", "geography-maps", "geography-flags"]);
      expect(result.geoCategories).toHaveLength(3);
      expect(result.triviaCategories).toHaveLength(0);
    });

    it("handles all trivia categories", () => {
      const result = separateCategories(["general", "science", "history"]);
      expect(result.geoCategories).toHaveLength(0);
      expect(result.triviaCategories).toHaveLength(3);
    });
  });

  describe("fetchQuestions", () => {
    // Suppress console.log for cleaner test output
    let originalConsoleLog: typeof console.log;
    let originalConsoleError: typeof console.error;

    beforeEach(() => {
      originalConsoleLog = console.log;
      originalConsoleError = console.error;
      console.log = () => {};
      console.error = () => {};
    });

    afterEach(() => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    });

    describe("single batch strategy (avoids rate limits)", () => {
      it("fetches trivia in a single batch call", async () => {
        let fetchCallCount = 0;

        const mockFetchTrivia = async ({ count }: { count: number }) => {
          fetchCallCount++;
          return Array(count)
            .fill(null)
            .map((_, i) =>
              createMockTriviaQuestion({
                text: `Q${i}`,
                category: "General Knowledge",
                difficulty: "medium",
              })
            );
        };

        const mockGenerateGeo = () => [];

        await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general", "science", "history"],
            difficulties: ["easy", "medium", "hard"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // Should only make ONE API call (single batch)
        expect(fetchCallCount).toBe(1);
      });

      it("filters batch results by user's selected categories", async () => {

        // Return questions from various categories
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return [
            createMockTriviaQuestion({ category: "General Knowledge", difficulty: "medium" }),
            createMockTriviaQuestion({ category: "Science & Nature", difficulty: "medium" }),
            createMockTriviaQuestion({ category: "History", difficulty: "medium" }),
            createMockTriviaQuestion({ category: "Sports", difficulty: "medium" }),
            createMockTriviaQuestion({ category: "Art", difficulty: "medium" }),
            ...Array(count - 5)
              .fill(null)
              .map(() => createMockTriviaQuestion({ category: "General Knowledge", difficulty: "medium" })),
          ];
        };

        const mockGenerateGeo = () => [];

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general"], // Only want general knowledge
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // All questions should be General Knowledge (or geography backfill)
        for (const q of questions) {
          if (q.type === "multiple_choice") {
            expect(q.category).toBe("General Knowledge");
          }
        }
      });

      it("filters batch results by user's selected difficulties", async () => {

        // Return questions with various difficulties
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return [
            createMockTriviaQuestion({ difficulty: "easy" }),
            createMockTriviaQuestion({ difficulty: "medium" }),
            createMockTriviaQuestion({ difficulty: "hard" }),
            createMockTriviaQuestion({ difficulty: "easy" }),
            createMockTriviaQuestion({ difficulty: "medium" }),
            ...Array(count - 5)
              .fill(null)
              .map(() => createMockTriviaQuestion({ difficulty: "hard" })),
          ];
        };

        const mockGenerateGeo = ({ difficulty }: { count: number; difficulty?: Difficulty }) => {
          return [createMockMapQuestion({ difficulty })];
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["any"],
            difficulties: ["hard"], // Only want hard
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // All trivia questions should be hard
        for (const q of questions) {
          if (q.type === "multiple_choice") {
            expect(q.difficulty).toBe("hard");
          }
        }
      });
    });

    describe("mixes traditional Open Trivia DB + maps + flags questions", () => {
      it("includes trivia, map, and flag questions when geography is selected", async () => {
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map((_, i) => createMockTriviaQuestion({ text: `Trivia Q${i}`, category: "General Knowledge" }));
        };

        // Use a running counter to alternate between map and flag
        let geoCallIndex = 0;
        const mockGenerateGeo = ({ count }: { count: number }) => {
          const questions: CustomQuestion[] = [];
          for (let i = 0; i < count; i++) {
            // Alternate between map and flag using running counter
            if (geoCallIndex % 2 === 0) {
              questions.push(createMockMapQuestion({ text: `Map Q${geoCallIndex}` }));
            } else {
              questions.push(createMockFlagQuestion({ text: `Flag Q${geoCallIndex}` }));
            }
            geoCallIndex++;
          }
          return questions;
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general", "geography-maps", "geography-flags"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        expect(questions.length).toBe(10);

        const types = questions.map((q) => q.type);
        expect(types).toContain("multiple_choice"); // trivia
        expect(types).toContain("map_country"); // maps
        expect(types).toContain("flag_country"); // flags
      });
    });

    describe("difficulty-based text input handling", () => {
      it("easy difficulty has no text input questions (all multiple choice)", async () => {
        const mockFetchTrivia = async () => [
          createMockTriviaQuestion({ difficulty: "easy" }),
        ];

        // For easy, generateMapQuestion/generateFlagQuestion always use multiple choice
        const mockGenerateGeo = ({ count, difficulty }: { count: number; difficulty?: string }) => {
          const questions: CustomQuestion[] = [];
          for (let i = 0; i < count; i++) {
            // Easy always has options (multiple choice)
            questions.push(
              createMockMapQuestion({
                difficulty: difficulty || "easy",
                options: ["France", "Germany", "Spain", "Italy"],
                timerSeconds: BASE_TIMER_SECONDS,
              })
            );
          }
          return questions;
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["geography-maps"],
            difficulties: ["easy"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // All questions should have options (no text input)
        for (const q of questions) {
          expect(q.options).toBeDefined();
          expect(q.options!.length).toBeGreaterThan(0);
        }
      });

      it("medium/hard difficulty has a mix of text input and multiple choice", async () => {
        const mockFetchTrivia = async () => [];

        // For medium/hard, 50% chance of text input - use running counter
        let geoCallIndex = 0;
        const mockGenerateGeo = ({ count }: { count: number }) => {
          const questions: CustomQuestion[] = [];
          for (let i = 0; i < count; i++) {
            if (geoCallIndex % 2 === 0) {
              // Multiple choice
              questions.push(
                createMockMapQuestion({
                  difficulty: "medium",
                  options: ["France", "Germany", "Spain", "Italy"],
                  timerSeconds: BASE_TIMER_SECONDS,
                })
              );
            } else {
              // Text input (no options)
              questions.push(createMockTextInputQuestion({ difficulty: "medium" }));
            }
            geoCallIndex++;
          }
          return questions;
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["geography-maps"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        const withOptions = questions.filter((q) => q.options && q.options.length > 0);
        const withoutOptions = questions.filter((q) => !q.options || q.options.length === 0);

        expect(withOptions.length).toBeGreaterThan(0);
        expect(withoutOptions.length).toBeGreaterThan(0);
      });
    });

    describe("text input timer bonus", () => {
      it("text input questions have +5s to their timers", async () => {
        const mockFetchTrivia = async () => [];

        const mockGenerateGeo = ({ count }: { count: number }) => {
          const questions: CustomQuestion[] = [];
          for (let i = 0; i < count; i++) {
            if (i % 2 === 0) {
              // Multiple choice - base timer
              questions.push(
                createMockMapQuestion({
                  options: ["France", "Germany", "Spain", "Italy"],
                  timerSeconds: BASE_TIMER_SECONDS,
                })
              );
            } else {
              // Text input - extra time
              questions.push(
                createMockTextInputQuestion({
                  timerSeconds: BASE_TIMER_SECONDS + TEXT_INPUT_EXTRA_SECONDS,
                })
              );
            }
          }
          return questions;
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["geography-maps"],
            difficulties: ["hard"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        for (const q of questions) {
          if (q.options && q.options.length > 0) {
            // Multiple choice should have base timer
            expect(q.timerSeconds).toBe(BASE_TIMER_SECONDS);
          } else {
            // Text input should have base + extra
            expect(q.timerSeconds).toBe(BASE_TIMER_SECONDS + TEXT_INPUT_EXTRA_SECONDS);
          }
        }
      });
    });

    describe("question count", () => {
      it("returns exactly the requested number of questions", async () => {
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map((_, i) => createMockTriviaQuestion({ text: `Q${i}`, category: "General Knowledge" }));
        };

        const mockGenerateGeo = ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map((_, i) => createMockMapQuestion({ text: `Geo Q${i}` }));
        };

        for (const questionCount of [5, 10, 15, 20, 50]) {
          const questions = await fetchQuestions({
            settings: {
              questionCount,
              categories: ["general", "geography-maps"],
              difficulties: ["medium"],
            },
            fetchTriviaQuestions: mockFetchTrivia,
            generateGeographyQuestions: mockGenerateGeo,
            shuffleArray: (arr) => arr,
          });

          expect(questions.length).toBe(questionCount);
        }
      });

      it("trims excess questions to match requested count", async () => {
        // Return more questions than requested
        const mockFetchTrivia = async () => {
          return Array(100)
            .fill(null)
            .map((_, i) => createMockTriviaQuestion({ text: `Q${i}` }));
        };

        const mockGenerateGeo = () => {
          return Array(100)
            .fill(null)
            .map((_, i) => createMockMapQuestion({ text: `Geo Q${i}` }));
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["any"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        expect(questions.length).toBe(10);
      });
    });

    describe("category = any includes maps & flags", () => {
      it("includes geography questions when category is 'any'", async () => {
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map((_, i) => createMockTriviaQuestion({ text: `Trivia Q${i}` }));
        };

        let geoCallParams: { count: number; mapPercentage?: number } | null = null;
        const mockGenerateGeo = (params: { count: number; mapPercentage?: number }) => {
          geoCallParams = params;
          const questions: CustomQuestion[] = [];
          for (let i = 0; i < params.count; i++) {
            if (i % 2 === 0) {
              questions.push(createMockMapQuestion({ text: `Map Q${i}` }));
            } else {
              questions.push(createMockFlagQuestion({ text: `Flag Q${i}` }));
            }
          }
          return questions;
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["any"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // Should have called generateGeographyQuestions
        expect(geoCallParams).not.toBeNull();
        expect(geoCallParams!.count).toBeGreaterThan(0);
        expect(geoCallParams!.mapPercentage).toBe(0.5); // Mix of maps and flags

        // Should have both trivia and geography questions
        const types = questions.map((q) => q.type);
        expect(types).toContain("multiple_choice"); // trivia
        expect(types.some((t) => t === "map_country" || t === "flag_country")).toBe(true);
      });

      it("allocates ~30% to geography when category is 'any'", async () => {
        let geoCount = 0;

        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map(() => createMockTriviaQuestion());
        };

        const mockGenerateGeo = ({ count }: { count: number }) => {
          geoCount += count; // Accumulate
          return Array(count)
            .fill(null)
            .map(() => createMockMapQuestion());
        };

        await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["any"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // ~30% geography
        expect(geoCount).toBe(3); // 10 - ceil(10 * 0.7)
      });
    });

    describe("category = [general knowledge + flags] gets both", () => {
      it("fetches both general knowledge and flags questions", async () => {
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map(() =>
              createMockTriviaQuestion({ category: "General Knowledge" })
            );
        };

        let geoCallParams: { mapPercentage?: number } | null = null;
        const mockGenerateGeo = (params: { count: number; mapPercentage?: number }) => {
          geoCallParams = params;
          return Array(params.count)
            .fill(null)
            .map(() => createMockFlagQuestion());
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general", "geography-flags"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // Should have generated flag questions (mapPercentage = 0 for flags only)
        expect(geoCallParams).not.toBeNull();
        expect(geoCallParams!.mapPercentage).toBe(0.0);

        // Should have both types
        const types = questions.map((q) => q.type);
        expect(types).toContain("multiple_choice"); // general knowledge
        expect(types).toContain("flag_country"); // flags
      });

      it("distributes questions proportionally between categories", async () => {
        let flagCount = 0;

        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return Array(count)
            .fill(null)
            .map(() => createMockTriviaQuestion({ category: "General Knowledge" }));
        };

        const mockGenerateGeo = ({ count }: { count: number }) => {
          flagCount += count; // Accumulate
          return Array(count)
            .fill(null)
            .map(() => createMockFlagQuestion());
        };

        await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general", "geography-flags"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // 50/50 split (1 geo category, 1 trivia category)
        expect(flagCount).toBe(5); // ceil(10 * 0.5)
      });
    });

    describe("maps only vs flags only", () => {
      it("generates only map questions when geography-maps is selected", async () => {
        let mapPercentage: number | undefined;
        const mockFetchTrivia = async () => [];
        const mockGenerateGeo = (params: { count: number; mapPercentage?: number }) => {
          mapPercentage = params.mapPercentage;
          return Array(params.count)
            .fill(null)
            .map(() => createMockMapQuestion());
        };

        await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["geography-maps"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        expect(mapPercentage).toBe(1.0);
      });

      it("generates only flag questions when geography-flags is selected", async () => {
        let mapPercentage: number | undefined;
        const mockFetchTrivia = async () => [];
        const mockGenerateGeo = (params: { count: number; mapPercentage?: number }) => {
          mapPercentage = params.mapPercentage;
          return Array(params.count)
            .fill(null)
            .map(() => createMockFlagQuestion());
        };

        await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["geography-flags"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        expect(mapPercentage).toBe(0.0);
      });
    });

    describe("error handling", () => {
      it("backfills with geography questions when API fails", async () => {

        const mockFetchTrivia = async () => {
          throw new Error("API error");
        };

        let geoCount = 0;
        const mockGenerateGeo = ({ count }: { count: number }) => {
          geoCount += count;
          return Array(count)
            .fill(null)
            .map(() => createMockMapQuestion());
        };

        // Should not throw, should backfill with geography
        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
          retryDelayMs: 0, // Skip delay in tests
        });

        expect(questions.length).toBe(10);
        expect(geoCount).toBe(10); // All backfilled with geography
      });

      it("backfills with geography questions when API returns fewer than requested", async () => {

        // API returns fewer questions than requested
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          // Only return 3 questions regardless of count
          return Array(3)
            .fill(null)
            .map(() => createMockTriviaQuestion());
        };

        let geoCount = 0;
        const mockGenerateGeo = ({ count }: { count: number }) => {
          geoCount += count;
          return Array(count)
            .fill(null)
            .map(() => createMockMapQuestion());
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["general"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // Should have exactly 10 questions (backfilled with geography)
        expect(questions.length).toBe(10);
        // Some questions should be geography (backfilled)
        expect(geoCount).toBeGreaterThan(0);
      });
    });

    describe("geography trivia category", () => {
      it("mixes trivia geography + custom questions when 'geography' category selected", async () => {
        let triviaCallCount = 0;
        let customGeoCount = 0;

        const mockFetchTrivia = async ({ count }: { count: number }) => {
          triviaCallCount++;
          return Array(count)
            .fill(null)
            .map(() => createMockTriviaQuestion({ category: "Geography" }));
        };

        const mockGenerateGeo = ({ count }: { count: number }) => {
          customGeoCount += count;
          return Array(count)
            .fill(null)
            .map(() => createMockMapQuestion());
        };

        await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["geography"],
            difficulties: ["medium"],
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // Should have fetched trivia (for geography trivia questions)
        expect(triviaCallCount).toBe(1);
        // Should have generated custom geography questions
        expect(customGeoCount).toBeGreaterThan(0);
      });
    });

    describe("difficulty filtering", () => {
      it("filters trivia questions by selected difficulties", async () => {

        // Return questions with various difficulties
        const mockFetchTrivia = async ({ count }: { count: number }) => {
          return [
            ...Array(Math.floor(count / 3))
              .fill(null)
              .map(() => createMockTriviaQuestion({ difficulty: "easy" })),
            ...Array(Math.floor(count / 3))
              .fill(null)
              .map(() => createMockTriviaQuestion({ difficulty: "medium" })),
            ...Array(Math.floor(count / 3))
              .fill(null)
              .map(() => createMockTriviaQuestion({ difficulty: "hard" })),
          ];
        };

        const mockGenerateGeo = ({ difficulty }: { count: number; difficulty?: Difficulty }) => {
          return [createMockMapQuestion({ difficulty })];
        };

        const questions = await fetchQuestions({
          settings: {
            questionCount: 10,
            categories: ["any"],
            difficulties: ["easy", "hard"], // No medium
          },
          fetchTriviaQuestions: mockFetchTrivia,
          generateGeographyQuestions: mockGenerateGeo,
          shuffleArray: (arr) => arr,
        });

        // Check that no trivia questions are medium
        for (const q of questions) {
          if (q.type === "multiple_choice") {
            expect(q.difficulty).not.toBe("medium");
          }
        }
      });

      it("geography questions use random difficulty from selected pool", async () => {
        const difficultiesUsed: Set<string> = new Set();

        const mockFetchTrivia = async () => [];

        const mockGenerateGeo = ({ difficulty }: { count: number; difficulty?: Difficulty }) => {
          if (difficulty) difficultiesUsed.add(difficulty);
          return [createMockMapQuestion({ difficulty })];
        };

        // Run multiple times to ensure randomness covers all difficulties
        for (let i = 0; i < 50; i++) {
          await fetchQuestions({
            settings: {
              questionCount: 1,
              categories: ["geography-maps"],
              difficulties: ["easy", "medium", "hard"],
            },
            fetchTriviaQuestions: mockFetchTrivia,
            generateGeographyQuestions: mockGenerateGeo,
            shuffleArray: (arr) => arr,
          });
        }

        // Should have used various difficulties
        expect(difficultiesUsed.size).toBeGreaterThan(1);
      });
    });
  });
});
