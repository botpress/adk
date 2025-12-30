/**
 * Flag question driver
 * Generates "guess the country by its flag" questions
 */

import {
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
 * Get flag URL from flagcdn
 */
function getFlagUrl(countryCode: string, size: "w80" | "w160" | "w320" = "w320"): string {
  return `https://flagcdn.com/${size}/${countryCode}.png`;
}

/**
 * Generate a single flag question
 * 50% chance of multiple choice, 50% chance of free text input (easy is always multiple choice)
 */
export function generateFlagQuestion(difficulty: Difficulty = "medium", timerSeconds: number = 20): Question {
  let eligibleCountries: CountryData[];

  if (difficulty === "easy") {
    // Countries with very distinctive flags
    const easyCountryCodes = [
      "us", "ca", "br", "jp", "gb", "fr", "de", "it",
      "es", "mx", "cn", "in", "au", "nz", "za", "ch",
      "se", "no", "dk", "gr", "tr", "kr", "ar", "cl",
    ];
    eligibleCountries = COUNTRIES.filter((c) => easyCountryCodes.includes(c.code));
  } else if (difficulty === "hard") {
    // All countries, including similar-looking flags
    eligibleCountries = COUNTRIES;
  } else {
    // Medium difficulty - most countries
    eligibleCountries = COUNTRIES;
  }

  const randomCountries = shuffleArray(eligibleCountries);
  const correctCountry = randomCountries[0];

  // 50% chance of multiple choice vs free text (easy always multiple choice)
  const useMultipleChoice = difficulty === "easy" ? true : Math.random() < 0.5;

  const question: Question = {
    text: useMultipleChoice
      ? "Which country does this flag belong to?"
      : "Name the country this flag belongs to:",
    type: "flag_country",
    correctAnswer: correctCountry.name,
    category: "Geography (Country Flags)",
    difficulty,
    timerSeconds: getTimerForQuestion(useMultipleChoice, timerSeconds),
    flagData: {
      countryCode: correctCountry.code,
      flagUrl: getFlagUrl(correctCountry.code),
    },
  };

  if (useMultipleChoice) {
    const incorrectCountries = getRandomIncorrectCountries(correctCountry, 3);
    question.options = shuffleArray([
      correctCountry.name,
      ...incorrectCountries.map((c) => c.name),
    ]);
  }

  return question;
}

/**
 * Create the flag question driver
 */
export function createFlagDriver(categoryLabel: string): CategoryDriver {
  return {
    category: "geography-flags",
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
          question = generateFlagQuestion(difficulty, timerSeconds);
          attempts++;
        } while (
          attempts < maxAttempts &&
          usedCountryCodes.has(question.flagData?.countryCode || "")
        );

        // Track the country code used
        if (question.flagData?.countryCode) {
          usedCountryCodes.add(question.flagData.countryCode);
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
