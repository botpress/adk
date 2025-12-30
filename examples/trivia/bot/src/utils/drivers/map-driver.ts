/**
 * Map question driver
 * Generates "guess the highlighted country on a map" questions
 */

import {
  ALPHA2_TO_ALPHA3,
  COUNTRIES,
  getRandomIncorrectCountries,
  type CountryData,
} from "../countries";
import {
  type CategoryDriver,
  type Difficulty,
  type Question,
  pickRandomDifficulty,
  shuffleArray,
  getTimerForQuestion,
} from "./types";

/**
 * Generate a single map question
 * 50% chance of multiple choice, 50% chance of free text input (easy is always multiple choice)
 */
export function generateMapQuestion(difficulty: Difficulty = "medium", timerSeconds: number = 20): Question {
  let eligibleCountries: CountryData[];

  if (difficulty === "easy") {
    // Well-known, large countries with distinctive shapes
    const easyCountryCodes = [
      "us", "ca", "br", "au", "ru", "cn", "in", "jp",
      "fr", "it", "es", "gb", "de", "mx", "eg", "za",
    ];
    eligibleCountries = COUNTRIES.filter((c) => easyCountryCodes.includes(c.code));
  } else if (difficulty === "hard") {
    // All countries including smaller/less known ones
    eligibleCountries = COUNTRIES;
  } else {
    // Medium: exclude very small countries
    const smallCountryCodes = ["sg", "mt", "lu", "qa", "cy"];
    eligibleCountries = COUNTRIES.filter((c) => !smallCountryCodes.includes(c.code));
  }

  const randomCountries = shuffleArray(eligibleCountries);
  const country = randomCountries[0];

  // 50% chance of multiple choice vs free text (easy always multiple choice)
  const useMultipleChoice = difficulty === "easy" ? true : Math.random() < 0.5;

  const question: Question = {
    text: useMultipleChoice
      ? "Which country is highlighted on the map?"
      : "Name the country highlighted on the map:",
    type: "map_country",
    correctAnswer: country.name,
    category: "Geography (Country Maps)",
    difficulty,
    timerSeconds: getTimerForQuestion(useMultipleChoice, timerSeconds),
    mapData: {
      countryCode: country.code,
      countryAlpha3: ALPHA2_TO_ALPHA3[country.code] || country.code.toUpperCase(),
      center: country.center,
      zoom: country.zoom,
    },
  };

  if (useMultipleChoice) {
    const incorrectCountries = getRandomIncorrectCountries(country, 3);
    question.options = shuffleArray([
      country.name,
      ...incorrectCountries.map((c) => c.name),
    ]);
  }

  return question;
}

/**
 * Create the map question driver
 */
export function createMapDriver(categoryLabel: string): CategoryDriver {
  return {
    category: "geography-maps",
    fetch: async (count: number, difficulties: Difficulty[], timerSeconds: number): Promise<Question[]> => {
      const questions: Question[] = [];
      const usedCountryCodes = new Set<string>();

      for (let i = 0; i < count; i++) {
        const difficulty = pickRandomDifficulty(difficulties);
        let question: Question;
        let attempts = 0;
        const maxAttempts = 20;

        // Try to generate a question with an unused country
        do {
          question = generateMapQuestion(difficulty, timerSeconds);
          attempts++;
        } while (
          attempts < maxAttempts &&
          usedCountryCodes.has(question.mapData?.countryCode || "")
        );

        // Track the country code used
        if (question.mapData?.countryCode) {
          usedCountryCodes.add(question.mapData.countryCode);
        }

        // Override category to official label
        questions.push({
          ...question,
          category: categoryLabel,
        });
      }

      return questions;
    },
  };
}
