/**
 * Custom question generators for geography-based trivia
 * - Map questions: Guess the highlighted country on a map
 * - Flag questions: Guess the country by its flag (multiple choice)
 */

import {
  ALPHA2_TO_ALPHA3,
  COUNTRIES,
  getRandomIncorrectCountries,
  type CountryData,
} from "./countries";

// Timer settings
const BASE_TIMER_SECONDS = 20;
const TEXT_INPUT_EXTRA_SECONDS = 5;

/**
 * Extended question type that includes custom geography questions
 */
export interface CustomQuestion {
  text: string;
  type:
    | "true_false"
    | "multiple_choice"
    | "text_input"
    | "map_country"
    | "flag_country";
  correctAnswer: string;
  options?: string[];
  category?: string;
  difficulty?: string;
  timerSeconds?: number; // Per-question timer (text input gets extra time)
  // For map questions
  mapData?: {
    countryCode: string; // ISO alpha-2 for flag lookup
    countryAlpha3: string; // ISO alpha-3 for react-simple-maps
    center: [number, number];
    zoom: number;
  };
  // For flag questions
  flagData?: {
    countryCode: string; // ISO alpha-2 for flagpedia
    flagUrl: string;
  };
}

/**
 * Calculate timer seconds based on question type
 * Text input questions get extra time
 */
function getTimerForQuestion(
  hasOptions: boolean,
  baseTimer: number = BASE_TIMER_SECONDS
): number {
  return hasOptions ? baseTimer : baseTimer + TEXT_INPUT_EXTRA_SECONDS;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get flag URL from flagpedia/flagcdn
 */
function getFlagUrl(
  countryCode: string,
  size: "w80" | "w160" | "w320" = "w320"
): string {
  return `https://flagcdn.com/${size}/${countryCode}.png`;
}

/**
 * Generate a "guess the country on the map" question
 * 50% chance of multiple choice, 50% chance of free text input
 */
export function generateMapQuestion(
  difficulty: "easy" | "medium" | "hard" = "medium"
): CustomQuestion {
  // Select countries based on difficulty
  let eligibleCountries: CountryData[];

  if (difficulty === "easy") {
    // Well-known, large countries with distinctive shapes
    const easyCountryCodes = [
      "us",
      "ca",
      "br",
      "au",
      "ru",
      "cn",
      "in",
      "jp",
      "fr",
      "it",
      "es",
      "gb",
      "de",
      "mx",
      "eg",
      "za",
    ];
    eligibleCountries = COUNTRIES.filter((c) =>
      easyCountryCodes.includes(c.code)
    );
  } else if (difficulty === "hard") {
    // All countries including smaller/less known ones
    eligibleCountries = COUNTRIES;
  } else {
    // Medium: exclude very small countries
    const smallCountryCodes = ["sg", "mt", "lu", "qa", "cy"];
    eligibleCountries = COUNTRIES.filter(
      (c) => !smallCountryCodes.includes(c.code)
    );
  }

  const randomCountries = shuffleArray(eligibleCountries);
  const country = randomCountries[0];

  // 50% chance of multiple choice vs free text
  const useMultipleChoice = difficulty === "easy" ? true : Math.random() < 0.5;

  const baseQuestion: CustomQuestion = {
    text: useMultipleChoice
      ? "Which country is highlighted on the map?"
      : "Name the country highlighted on the map:",
    type: "map_country",
    correctAnswer: country.name,
    category: "Geography",
    difficulty,
    timerSeconds: getTimerForQuestion(useMultipleChoice),
    mapData: {
      countryCode: country.code,
      countryAlpha3:
        ALPHA2_TO_ALPHA3[country.code] || country.code.toUpperCase(),
      center: country.center,
      zoom: country.zoom,
    },
  };

  // Add options for multiple choice
  if (useMultipleChoice) {
    const incorrectCountries = getRandomIncorrectCountries(country, 3);
    baseQuestion.options = shuffleArray([
      country.name,
      ...incorrectCountries.map((c) => c.name),
    ]);
  }

  return baseQuestion;
}

/**
 * Generate a "guess the country by its flag" question
 * 50% chance of multiple choice, 50% chance of free text input
 */
export function generateFlagQuestion(
  difficulty: "easy" | "medium" | "hard" = "medium"
): CustomQuestion {
  // Select countries based on difficulty
  let eligibleCountries: CountryData[];

  if (difficulty === "easy") {
    // Countries with very distinctive flags
    const easyCountryCodes = [
      "us",
      "ca",
      "br",
      "jp",
      "gb",
      "fr",
      "de",
      "it",
      "es",
      "mx",
      "cn",
      "in",
      "au",
      "nz",
      "za",
      "ch",
      "se",
      "no",
      "dk",
      "gr",
      "tr",
      "kr",
      "ar",
      "cl",
    ];
    eligibleCountries = COUNTRIES.filter((c) =>
      easyCountryCodes.includes(c.code)
    );
  } else if (difficulty === "hard") {
    // All countries, including similar-looking flags
    eligibleCountries = COUNTRIES;
  } else {
    // Medium difficulty - most countries
    eligibleCountries = COUNTRIES;
  }

  const randomCountries = shuffleArray(eligibleCountries);
  const correctCountry = randomCountries[0];

  // 50% chance of multiple choice vs free text
  const useMultipleChoice = difficulty === "easy" ? true : Math.random() < 0.5;

  const baseQuestion: CustomQuestion = {
    text: useMultipleChoice
      ? "Which country does this flag belong to?"
      : "Name the country this flag belongs to:",
    type: "flag_country",
    correctAnswer: correctCountry.name,
    category: "Geography",
    difficulty,
    timerSeconds: getTimerForQuestion(useMultipleChoice),
    flagData: {
      countryCode: correctCountry.code,
      flagUrl: getFlagUrl(correctCountry.code),
    },
  };

  // Add options for multiple choice
  if (useMultipleChoice) {
    const incorrectCountries = getRandomIncorrectCountries(correctCountry, 3);
    baseQuestion.options = shuffleArray([
      correctCountry.name,
      ...incorrectCountries.map((c) => c.name),
    ]);
  }

  return baseQuestion;
}

/**
 * Generate a batch of custom geography questions
 * Mixes map and flag questions
 */
export function generateGeographyQuestions(opts: {
  count: number;
  difficulty?: "easy" | "medium" | "hard" | "any";
  mapPercentage?: number; // 0-1, default 0.5 (50% map, 50% flag)
}): CustomQuestion[] {
  const { count, difficulty = "medium", mapPercentage = 0.5 } = opts;
  const questions: CustomQuestion[] = [];

  const actualDifficulty =
    difficulty === "any"
      ? (["easy", "medium", "hard"][Math.floor(Math.random() * 3)] as
          | "easy"
          | "medium"
          | "hard")
      : difficulty;

  // Track used countries to avoid repeats
  const usedCountryCodes = new Set<string>();

  for (let i = 0; i < count; i++) {
    const isMapQuestion = Math.random() < mapPercentage;

    // For varying difficulty within "any" mode
    const questionDifficulty =
      difficulty === "any"
        ? (["easy", "medium", "hard"][Math.floor(Math.random() * 3)] as
            | "easy"
            | "medium"
            | "hard")
        : actualDifficulty;

    let question: CustomQuestion;
    let attempts = 0;
    const maxAttempts = 20;

    // Try to generate a question with an unused country
    do {
      question = isMapQuestion
        ? generateMapQuestion(questionDifficulty)
        : generateFlagQuestion(questionDifficulty);
      attempts++;
    } while (
      attempts < maxAttempts &&
      usedCountryCodes.has(
        question.mapData?.countryCode || question.flagData?.countryCode || ""
      )
    );

    // Track the country code used
    const countryCode =
      question.mapData?.countryCode || question.flagData?.countryCode;
    if (countryCode) {
      usedCountryCodes.add(countryCode);
    }

    questions.push(question);
  }

  return questions;
}

/**
 * Mix custom geography questions into an existing question set
 * Replaces some questions with geography questions
 */
export function mixInGeographyQuestions<T extends { type: string }>(
  existingQuestions: T[],
  geographyPercentage: number = 0.3, // 30% geography questions by default
  difficulty: "easy" | "medium" | "hard" | "any" = "medium"
): (T | CustomQuestion)[] {
  const totalCount = existingQuestions.length;
  const geographyCount = Math.round(totalCount * geographyPercentage);
  const triviaCount = totalCount - geographyCount;

  // Take only the needed trivia questions
  const selectedTrivia = existingQuestions.slice(0, triviaCount);

  // Generate geography questions
  const geographyQuestions = generateGeographyQuestions({
    count: geographyCount,
    difficulty,
    mapPercentage: 0.5,
  });

  // Combine and shuffle
  const combined = [...selectedTrivia, ...geographyQuestions];
  return shuffleArray(combined);
}
