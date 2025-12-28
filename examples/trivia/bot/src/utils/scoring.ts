import { adk } from "@botpress/runtime";
import { z } from "@botpress/runtime";

/**
 * Answer from a player (collected from delegate)
 */
export interface PlayerAnswer {
  visibleUserId: string;
  username: string;
  status: "pending" | "acked" | "fulfilled" | "rejected";
  answer?: string;
  timeToAnswerMs?: number;
}

/**
 * Scored answer result
 */
export interface ScoredAnswer {
  visibleUserId: string;
  username: string;
  answer?: string;
  isCorrect: boolean;
  points: number;
  timeToAnswerMs?: number;
}

/**
 * Check if two answers match (exact or fuzzy for text input)
 */
async function isAnswerCorrect(
  userAnswer: string | undefined,
  correctAnswer: string,
  questionType: "true_false" | "multiple_choice" | "text_input"
): Promise<{ isCorrect: boolean; similarity: number }> {
  if (!userAnswer) {
    return { isCorrect: false, similarity: 0 };
  }

  // For true/false and multiple choice, exact match (case-insensitive)
  if (questionType !== "text_input") {
    const isCorrect =
      userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    return { isCorrect, similarity: isCorrect ? 1 : 0 };
  }

  // For text input, use zai for fuzzy matching
  try {
    const result = await adk.zai.extract(
      `User's answer: "${userAnswer}"
Correct answer: "${correctAnswer}"

Evaluate if the user's answer is essentially correct, accounting for:
- Minor typos and misspellings
- Case differences
- Extra/missing punctuation
- Common abbreviations
- Partial answers (if they got the main point)`,
      z.object({
        isCorrect: z
          .boolean()
          .describe("Is the answer essentially correct?"),
        similarity: z
          .number()
          .min(0)
          .max(1)
          .describe("How similar/correct is the answer (0-1)"),
      })
    );
    return result;
  } catch (error) {
    // Fallback to exact match if zai fails
    console.error("[Scoring] zai.extract failed, falling back to exact match", error);
    const isCorrect =
      userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
    return { isCorrect, similarity: isCorrect ? 1 : 0 };
  }
}

/**
 * Score answers using "first-right" method
 * First correct answer gets 100 points, everyone else gets 0
 */
async function scoreFirstRight(
  answers: PlayerAnswer[],
  correctAnswer: string,
  questionType: "true_false" | "multiple_choice" | "text_input"
): Promise<ScoredAnswer[]> {
  // Evaluate all answers
  const evaluations = await Promise.all(
    answers.map(async (a) => ({
      ...a,
      evaluation: await isAnswerCorrect(a.answer, correctAnswer, questionType),
    }))
  );

  // Find correct answers sorted by time
  const correctAnswers = evaluations
    .filter((a) => a.evaluation.isCorrect && a.status === "fulfilled")
    .sort((a, b) => (a.timeToAnswerMs || Infinity) - (b.timeToAnswerMs || Infinity));

  const winnerId = correctAnswers[0]?.visibleUserId;

  return evaluations.map((a) => ({
    visibleUserId: a.visibleUserId,
    username: a.username,
    answer: a.answer,
    isCorrect: a.evaluation.isCorrect,
    points: a.visibleUserId === winnerId ? 100 : 0,
    timeToAnswerMs: a.timeToAnswerMs,
  }));
}

/**
 * Score answers using "time-right" method
 * Points proportional to speed (faster = more points, max 100)
 */
async function scoreTimeRight(
  answers: PlayerAnswer[],
  correctAnswer: string,
  questionType: "true_false" | "multiple_choice" | "text_input",
  timerSeconds: number
): Promise<ScoredAnswer[]> {
  const maxTimeMs = timerSeconds * 1000;

  const evaluations = await Promise.all(
    answers.map(async (a) => ({
      ...a,
      evaluation: await isAnswerCorrect(a.answer, correctAnswer, questionType),
    }))
  );

  return evaluations.map((a) => {
    if (!a.evaluation.isCorrect || a.status !== "fulfilled") {
      return {
        visibleUserId: a.visibleUserId,
        username: a.username,
        answer: a.answer,
        isCorrect: false,
        points: 0,
        timeToAnswerMs: a.timeToAnswerMs,
      };
    }

    // Calculate points based on time (faster = more points)
    const timeMs = a.timeToAnswerMs || maxTimeMs;
    const ratio = Math.max(0, 1 - timeMs / maxTimeMs);
    const points = Math.round(ratio * 100 * a.evaluation.similarity);

    return {
      visibleUserId: a.visibleUserId,
      username: a.username,
      answer: a.answer,
      isCorrect: true,
      points,
      timeToAnswerMs: a.timeToAnswerMs,
    };
  });
}

/**
 * Score answers using "all-right" method
 * Everyone who answers correctly gets 100 points
 */
async function scoreAllRight(
  answers: PlayerAnswer[],
  correctAnswer: string,
  questionType: "true_false" | "multiple_choice" | "text_input"
): Promise<ScoredAnswer[]> {
  const evaluations = await Promise.all(
    answers.map(async (a) => ({
      ...a,
      evaluation: await isAnswerCorrect(a.answer, correctAnswer, questionType),
    }))
  );

  return evaluations.map((a) => {
    const isCorrect = a.evaluation.isCorrect && a.status === "fulfilled";
    // For text input with partial correctness, award partial points
    const points = isCorrect ? Math.round(100 * a.evaluation.similarity) : 0;

    return {
      visibleUserId: a.visibleUserId,
      username: a.username,
      answer: a.answer,
      isCorrect,
      points,
      timeToAnswerMs: a.timeToAnswerMs,
    };
  });
}

/**
 * Score all answers based on the scoring method
 */
export async function scoreAnswers(
  answers: PlayerAnswer[],
  correctAnswer: string,
  questionType: "true_false" | "multiple_choice" | "text_input",
  scoreMethod: "first-right" | "time-right" | "all-right",
  timerSeconds: number
): Promise<ScoredAnswer[]> {
  switch (scoreMethod) {
    case "first-right":
      return scoreFirstRight(answers, correctAnswer, questionType);
    case "time-right":
      return scoreTimeRight(answers, correctAnswer, questionType, timerSeconds);
    case "all-right":
      return scoreAllRight(answers, correctAnswer, questionType);
    default:
      throw new Error(`Unknown score method: ${scoreMethod}`);
  }
}

/**
 * Get leaderboard from players sorted by score
 */
export function getLeaderboard(
  players: Array<{ visibleUserId: string; username: string; score: number }>
): Array<{ rank: number; visibleUserId: string; username: string; score: number }> {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  let currentRank = 1;
  let previousScore = -1;

  return sorted.map((player, index) => {
    // Handle ties - same score = same rank
    if (player.score !== previousScore) {
      currentRank = index + 1;
      previousScore = player.score;
    }

    return {
      rank: currentRank,
      visibleUserId: player.visibleUserId,
      username: player.username,
      score: player.score,
    };
  });
}
