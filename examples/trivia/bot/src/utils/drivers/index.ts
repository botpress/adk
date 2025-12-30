/**
 * Question drivers
 * Each driver knows how to fetch questions for a specific category type
 */

export { createMapDriver, generateMapQuestion } from "./map-driver";
export { createFlagDriver, generateFlagQuestion } from "./flag-driver";
export { createTableDriver } from "./table-driver";
export {
  type CategoryDriver,
  type Difficulty,
  type Question,
  pickRandomDifficulty,
  shuffleArray,
  getTimerForQuestion,
  TEXT_INPUT_EXTRA_SECONDS,
} from "./types";
