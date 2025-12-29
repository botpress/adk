import { actions, context, Workflow, z } from "@botpress/runtime";

import { fetchQuestions } from "../utils/fetch-questions";

const STEP_MAX_ATTEMPTS = 5;
import {
  getLeaderboard,
  type PlayerAnswer,
  scoreAnswers,
} from "../utils/scoring";
import { translateQuestions } from "../utils/translate";
import { GameSettingsSchema, PlayerSchema } from "../conversations/types";

/**
 * Question schema
 */
const QuestionSchema = z.object({
  text: z.string(),
  type: z.enum([
    "true_false",
    "multiple_choice",
    "text_input",
    "map_country",
    "flag_country",
  ]),
  correctAnswer: z.string(),
  options: z.array(z.string()).optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
  timerSeconds: z.number().optional(),
  // For map questions
  mapData: z
    .object({
      countryCode: z.string(),
      countryAlpha3: z.string(),
      center: z.tuple([z.number(), z.number()]),
      zoom: z.number(),
    })
    .optional(),
  // For flag questions
  flagData: z
    .object({
      countryCode: z.string(),
      flagUrl: z.string(),
    })
    .optional(),
});

/**
 * Answer delegate schema - what the frontend submits
 */
const AnswerSchema = z.object({
  answer: z.string(),
  timeToAnswerMs: z.number(),
});

/**
 * Delegate info stored between steps
 */
const DelegateInfoSchema = z.object({
  visibleUserId: z.string(),
  delegateId: z.string(),
  ack_url: z.string(),
  fulfill_url: z.string(),
  reject_url: z.string(),
});

type DelegateInfo = z.infer<typeof DelegateInfoSchema>;

/**
 * Play Quiz Workflow
 *
 * Handles the entire game flow:
 * 1. Fetch questions from Open Trivia DB
 * 2. For each question (each in its own step):
 *    - Create delegates for each player
 *    - Send delegate map to game conversation
 *    - Wait for timer
 *    - Collect and score answers
 *    - Send scores
 *    - Update cumulative scores
 * 3. Send final leaderboard
 */
export default new Workflow({
  name: "play_quiz",
  timeout: "2h",

  input: z.object({
    gameConversationId: z.string(),
    players: z.array(PlayerSchema),
    settings: GameSettingsSchema,
  }),

  output: z.object({
    finalLeaderboard: z.array(
      z.object({
        rank: z.number(),
        username: z.string(),
        score: z.number(),
      })
    ),
  }),

  state: z.object({
    questions: z.array(QuestionSchema).default([]),
    playerScores: z
      .record(z.string(), z.number())
      .default({})
      .describe("Map of visibleUserId -> total score"),
  }),

  handler: async ({ input, step, state }) => {
    const { gameConversationId, players, settings } = input;
    const client = context.get("client");
    const botId = context.get("botId");

    console.log("[PlayQuiz] ====== WORKFLOW STARTED ======");
    console.log("[PlayQuiz] Game conversation:", gameConversationId);
    console.log(
      "[PlayQuiz] Players:",
      players.map((p) => p.username)
    );
    console.log("[PlayQuiz] Settings:", settings);

    // Find creator
    const creator = players.find((p) => p.isCreator);
    if (!creator) {
      throw new Error("No creator found in players list");
    }
    console.log("[PlayQuiz] Creator:", creator.username);

    // Initialize player scores
    for (const player of players) {
      state.playerScores[player.visibleUserId] = 0;
    }

    // ========================================
    // STEP: Fetch questions from multiple sources based on selected categories
    // ========================================
    const fetchedQuestions = await step(
      "fetch-questions",
      async () => {
        console.log("[PlayQuiz] Fetching questions...");
        console.log("[PlayQuiz]   Count:", settings.questionCount);
        console.log("[PlayQuiz]   Categories:", settings.categories);
        console.log(
          "[PlayQuiz]   Difficulties:",
          settings.difficulties.join(", ")
        );

        const questions = await fetchQuestions({ settings });
        console.log("[PlayQuiz] Total questions prepared:", questions.length);

        return questions;
      },
      { maxAttempts: STEP_MAX_ATTEMPTS }
    );

    // ========================================
    // STEP: Translate questions if needed
    // ========================================
    const questions = await step(
      "translate-questions",
      async () => {
        const language = settings.language || "english";
        if (language.toLowerCase() === "english") {
          console.log("[PlayQuiz] Language is English, skipping translation");
          return fetchedQuestions;
        }

        console.log("[PlayQuiz] Translating questions to", language);
        const translated = await translateQuestions(fetchedQuestions, language);
        console.log("[PlayQuiz] Translation complete");
        return translated;
      },
      { maxAttempts: STEP_MAX_ATTEMPTS }
    );

    state.questions = questions;

    // ========================================
    // STEP: Wait for splash screen countdown (5 seconds)
    // ========================================
    console.log("[PlayQuiz] Waiting 5 seconds for splash screen countdown...");
    await step.sleep("splash-countdown", 5000);
    console.log("[PlayQuiz] Splash countdown complete, starting questions");

    // ========================================
    // Loop over each question
    // ========================================
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const questionNumber = i + 1;

      // Each question has its own step
      await step(
        `question-${i}`,
        async () => {
          console.log(
            "[PlayQuiz] ====== QUESTION",
            questionNumber,
            "/",
            questions.length,
            "======"
          );
          console.log("[PlayQuiz] Question:", question.text);
          console.log("[PlayQuiz] Type:", question.type);
          console.log("[PlayQuiz] Category:", question.category);
          console.log("[PlayQuiz] Difficulty:", question.difficulty);
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      // Use question-specific timer if available, otherwise use settings
      const questionTimer = question.timerSeconds ?? settings.timerSeconds;

      // Create delegates for all players
      const delegates = await step(
        `question-${i}-create-delegates`,
        async () => {
          console.log(
            "[PlayQuiz] Creating delegates for",
            players.length,
            "players..."
          );

          const createdDelegates: DelegateInfo[] = await Promise.all(
            players.map(async (player) => {
              const { delegate } = await actions.delegate.create({
                name: "trivia-answer",
                input: {
                  questionIndex: i,
                  visibleUserId: player.visibleUserId,
                  gameConversationId,
                },
                schema: AnswerSchema.toJSONSchema(),
                ttl: questionTimer + 10,
                ack: 5,
                subscribe: true,
              });

              console.log(
                "[PlayQuiz]   Created delegate for",
                player.username,
                ":",
                delegate.id
              );

              return {
                visibleUserId: player.visibleUserId,
                delegateId: delegate.id,
                ack_url: delegate.ack_url,
                fulfill_url: delegate.fulfill_url,
                reject_url: delegate.reject_url,
              };
            })
          );

          console.log("[PlayQuiz] All delegates created");
          return createdDelegates;
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      // Send delegate map to game conversation (so frontend knows which delegate is for which player)
      await step(
        `question-${i}-send-delegate-map`,
        async () => {
          console.log(
            "[PlayQuiz] Sending delegate map to game conversation..."
          );

          const delegateMap: Record<
            string,
            {
              id: string;
              ack_url: string;
              fulfill_url: string;
              reject_url: string;
            }
          > = {};
          for (const d of delegates) {
            delegateMap[d.visibleUserId] = {
              id: d.delegateId,
              ack_url: d.ack_url,
              fulfill_url: d.fulfill_url,
              reject_url: d.reject_url,
            };
          }

          await client.createMessage({
            conversationId: gameConversationId,
            userId: botId,
            type: "text",
            payload: {
              text: JSON.stringify({
                type: "question_start",
                questionIndex: i,
                totalQuestions: questions.length,
                question: question.text,
                questionType: question.type,
                options: question.options,
                category: question.category,
                difficulty: question.difficulty,
                timerSeconds: questionTimer,
                delegates: delegateMap,
                // Include map/flag data for geography questions
                mapData: question.mapData,
                flagData: question.flagData,
              }),
            },
            tags: {},
          });

          console.log("[PlayQuiz] Delegate map sent");
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      // Wait for timer to expire
      console.log(
        "[PlayQuiz] Waiting",
        questionTimer,
        "seconds for answers..."
      );
      await step.sleep(`question-${i}-wait-timer`, questionTimer * 1000);
      console.log("[PlayQuiz] Timer expired");

      // Collect all answers from delegates
      const answers = await step(
        `question-${i}-collect-answers`,
        async () => {
          console.log("[PlayQuiz] Collecting answers from delegates...");

          const collected: PlayerAnswer[] = await Promise.all(
            delegates.map(async (d: DelegateInfo) => {
              const player = players.find(
                (p) => p.visibleUserId === d.visibleUserId
              );
              const { delegate: updatedDelegate } = await actions.delegate.get({
                id: d.delegateId,
              });

              const output = updatedDelegate.output as
                | { answer?: string; timeToAnswerMs?: number }
                | undefined;
              console.log(
                "[PlayQuiz]   Player",
                player?.username,
                ":",
                updatedDelegate.status,
                "-",
                output?.answer
              );

              return {
                visibleUserId: d.visibleUserId,
                username: player?.username || "Unknown",
                status: updatedDelegate.status,
                answer: output?.answer,
                timeToAnswerMs: output?.timeToAnswerMs,
              };
            })
          );

          console.log("[PlayQuiz] Collected", collected.length, "answers");
          return collected;
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      // Score answers
      const scores = await step(
        `question-${i}-compute-scores`,
        async () => {
          console.log("[PlayQuiz] Computing scores...");
          console.log("[PlayQuiz]   Correct answer:", question.correctAnswer);
          console.log("[PlayQuiz]   Score method:", settings.scoreMethod);

          const computed = await scoreAnswers(
            answers,
            question.correctAnswer,
            question.type,
            settings.scoreMethod,
            questionTimer
          );

          for (const s of computed) {
            console.log(
              "[PlayQuiz]   ",
              s.username,
              ":",
              s.isCorrect ? "CORRECT" : "WRONG",
              "+",
              s.points,
              "points"
            );
          }

          return computed;
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      // Update cumulative player scores first (before sending to frontend)
      const updatedScores = await step(
        `question-${i}-update-scores`,
        async () => {
          console.log("[PlayQuiz] Updating cumulative scores...");

          const newPlayerScores: Record<string, number> = {
            ...state.playerScores,
          };

          for (const score of scores) {
            newPlayerScores[score.visibleUserId] =
              (newPlayerScores[score.visibleUserId] || 0) + score.points;

            const player = players.find(
              (p) => p.visibleUserId === score.visibleUserId
            );
            console.log(
              "[PlayQuiz]   ",
              player?.username,
              "total:",
              newPlayerScores[score.visibleUserId]
            );
          }

          return newPlayerScores;
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      // Persist updated scores to state
      state.playerScores = updatedScores;

      // Send question scores to game conversation (with cumulative totals)
      await step(
        `question-${i}-send-scores`,
        async () => {
          console.log("[PlayQuiz] Sending question scores...");

          const scoreResults = scores.map((s) => ({
            visibleUserId: s.visibleUserId,
            username: s.username,
            answer: s.answer,
            isCorrect: s.isCorrect,
            points: s.points,
            cumulativeScore: state.playerScores[s.visibleUserId] || 0,
            timeToAnswerMs: s.timeToAnswerMs,
          }));

          await client.createMessage({
            conversationId: gameConversationId,
            userId: botId,
            type: "text",
            payload: {
              text: JSON.stringify({
                type: "question_scores",
                questionIndex: i,
                totalQuestions: questions.length,
                correctAnswer: question.correctAnswer,
                scores: scoreResults,
              }),
            },
            tags: {},
          });

          console.log("[PlayQuiz] Question scores sent");
        },
        { maxAttempts: STEP_MAX_ATTEMPTS }
      );

      console.log("[PlayQuiz] Question", questionNumber, "complete");

      // Pause between questions

      console.log("[PlayQuiz] Pausing 5 seconds before next question...");
      await step.sleep(`question-${i}-pause`, 5000);
    }

    // ========================================
    // STEP: Final leaderboard
    // ========================================
    console.log("[PlayQuiz] ====== ALL QUESTIONS COMPLETE ======");

    const finalLeaderboard = getLeaderboard(
      players.map((p) => ({
        visibleUserId: p.visibleUserId,
        username: p.username,
        score: state.playerScores[p.visibleUserId] || 0,
      }))
    );

    console.log("[PlayQuiz] Final leaderboard:");
    for (const entry of finalLeaderboard) {
      console.log(
        "[PlayQuiz]   #",
        entry.rank,
        entry.username,
        "-",
        entry.score,
        "points"
      );
    }

    await step(
      "send-final-leaderboard",
      async () => {
        console.log(
          "[PlayQuiz] Sending final leaderboard to game conversation..."
        );

        await client.createMessage({
          conversationId: gameConversationId,
          userId: botId,
          type: "text",
          payload: {
            text: JSON.stringify({
              type: "game_scores",
              leaderboard: finalLeaderboard,
            }),
          },
          tags: {},
        });

        console.log("[PlayQuiz] Final leaderboard sent");
      },
      { maxAttempts: STEP_MAX_ATTEMPTS }
    );

    console.log("[PlayQuiz] ====== WORKFLOW COMPLETE ======");

    return {
      finalLeaderboard: finalLeaderboard.map((l) => ({
        rank: l.rank,
        username: l.username,
        score: l.score,
      })),
    };
  },
});
