import { actions, context, Workflow, z } from "@botpress/runtime";
import { GameSettingsSchema, PlayerSchema } from "../conversations";
import { fetchTriviaQuestions } from "../utils/open-trivia-api";
import {
  getLeaderboard,
  type PlayerAnswer,
  scoreAnswers,
} from "../utils/scoring";

/**
 * Question schema
 */
const QuestionSchema = z.object({
  text: z.string(),
  type: z.enum(["true_false", "multiple_choice", "text_input"]),
  correctAnswer: z.string(),
  options: z.array(z.string()).optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
});

type Question = z.infer<typeof QuestionSchema>;

/**
 * Answer delegate schema - what the frontend submits
 */
const AnswerSchema = z.object({
  answer: z.string(),
  timeToAnswerMs: z.number(),
});

/**
 * Play Quiz Workflow
 *
 * Handles the entire game flow:
 * 1. Fetch questions from Open Trivia DB
 * 2. For each question:
 *    - Create delegates for each player
 *    - Broadcast question with delegate to each player
 *    - Wait for timer to expire
 *    - Collect and score answers
 *    - Broadcast scores
 *    - Wait for creator to click "Next"
 * 3. Show final leaderboard
 */
export default new Workflow({
  name: "play_quiz",
  timeout: "2h", // Games can take a while

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
    delegateIds: z.array(z.string()).default([]),
  }),

  handler: async ({ input, step, state }) => {
    const { gameConversationId, players, settings } = input;
    const client = context.get("client");
    const botId = context.get("botId");

    // Find creator
    const creator = players.find((p) => p.isCreator);
    if (!creator) {
      throw new Error("No creator found in players list");
    }

    // Initialize player scores
    for (const player of players) {
      state.playerScores[player.visibleUserId] = 0;
    }

    // ========================================
    // STEP 1: Fetch questions from Open Trivia DB
    // ========================================
    const questions = await step("fetch-questions", async () => {
      console.log(`[PlayQuiz] Fetching ${settings.questionCount} questions...`);

      const fetched = await fetchTriviaQuestions({
        count: settings.questionCount,
        category: settings.categories[0],
        difficulty: settings.difficulty,
      });

      console.log(`[PlayQuiz] Fetched ${fetched.length} questions`);
      return fetched;
    });

    state.questions = questions;

    // ========================================
    // STEP 2: Run each question
    // ========================================
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const questionNumber = i + 1;

      console.log(
        `[PlayQuiz] Starting question ${questionNumber}/${questions.length}`
      );

      // 2a. Create delegates for all players
      const delegates = await step(`create-delegates-${i}`, async () => {
        const createdDelegates = await Promise.all(
          players.map(async (player) => {
            const { delegate } = await actions.delegate.create({
              name: "trivia-answer",
              input: {
                questionIndex: i,
                visibleUserId: player.visibleUserId,
                gameConversationId,
              },
              schema: AnswerSchema.toJSONSchema(),
              ttl: settings.timerSeconds + 10, // Extra buffer for network
              ack: 5,
              subscribe: true,
            });
            return {
              visibleUserId: player.visibleUserId,
              delegate,
            };
          })
        );
        return createdDelegates;
      });

      // Store delegate IDs for later retrieval
      state.delegateIds = delegates.map((d) => d.delegate.id);

      // 2b. Broadcast question + delegate to each player
      await step(`broadcast-question-${i}`, async () => {
        for (const { visibleUserId, delegate } of delegates) {
          const player = players.find((p) => p.visibleUserId === visibleUserId);
          if (!player) continue;

          await client.createMessage({
            conversationId: player.visibleConversationId,
            userId: botId,
            type: "custom",
            payload: {
              name: "trivia_question",
              url: "custom://trivia_question",
              data: {
                gameConversationId,
                questionIndex: i,
                totalQuestions: questions.length,
                question: question.text,
                questionType: question.type,
                options: question.options,
                category: question.category,
                difficulty: question.difficulty,
                timerSeconds: settings.timerSeconds,
                delegate: {
                  id: delegate.id,
                  ack_url: delegate.ack_url,
                  fulfill_url: delegate.fulfill_url,
                  reject_url: delegate.reject_url,
                },
              },
            },
            tags: {},
          });
        }
      });

      // 2c. Wait for timer to expire
      await step.sleep(`timer-${i}`, settings.timerSeconds * 1000);

      // 2d. Collect all answers from delegates
      const answers = await step(`collect-answers-${i}`, async () => {
        const collected: PlayerAnswer[] = await Promise.all(
          delegates.map(async ({ visibleUserId, delegate }) => {
            const player = players.find(
              (p) => p.visibleUserId === visibleUserId
            );
            const { delegate: updatedDelegate } = await actions.delegate.get({
              id: delegate.id,
            });

            return {
              visibleUserId,
              username: player?.username || "Unknown",
              status: updatedDelegate.status,
              answer: updatedDelegate.output?.answer,
              timeToAnswerMs: updatedDelegate.output?.timeToAnswerMs,
            };
          })
        );
        return collected;
      });

      // 2e. Score answers
      const scores = await step(`score-${i}`, async () => {
        return scoreAnswers(
          answers,
          question.correctAnswer,
          question.type,
          settings.scoreMethod,
          settings.timerSeconds
        );
      });

      // 2f. Update player scores
      for (const score of scores) {
        state.playerScores[score.visibleUserId] =
          (state.playerScores[score.visibleUserId] || 0) + score.points;
      }

      // Build current leaderboard
      const currentLeaderboard = getLeaderboard(
        players.map((p) => ({
          visibleUserId: p.visibleUserId,
          username: p.username,
          score: state.playerScores[p.visibleUserId] || 0,
        }))
      );

      // 2g. Broadcast scores to all players
      await step(`broadcast-scores-${i}`, async () => {
        for (const player of players) {
          const playerScore = scores.find(
            (s) => s.visibleUserId === player.visibleUserId
          );

          await client.createMessage({
            conversationId: player.visibleConversationId,
            userId: botId,
            type: "custom",
            payload: {
              name: "trivia_score",
              url: "custom://trivia_score",
              data: {
                gameConversationId,
                questionIndex: i,
                totalQuestions: questions.length,
                correctAnswer: question.correctAnswer,
                yourAnswer: playerScore?.answer,
                yourPoints: playerScore?.points || 0,
                isCorrect: playerScore?.isCorrect || false,
                leaderboard: currentLeaderboard,
                isLastQuestion: i === questions.length - 1,
                isCreator: player.visibleUserId === creator.visibleUserId,
              },
            },
            tags: {},
          });
        }
      });

      // 2h. Wait for creator to click "Next" (except for last question)
      if (i < questions.length - 1) {
        await step.request(`wait-next-${i}`);
      }
    }

    // ========================================
    // STEP 3: Final leaderboard
    // ========================================
    const finalLeaderboard = getLeaderboard(
      players.map((p) => ({
        visibleUserId: p.visibleUserId,
        username: p.username,
        score: state.playerScores[p.visibleUserId] || 0,
      }))
    );

    await step("broadcast-leaderboard", async () => {
      for (const player of players) {
        await client.createMessage({
          conversationId: player.visibleConversationId,
          userId: botId,
          type: "custom",
          payload: {
            name: "trivia_leaderboard",
            url: "custom://trivia_leaderboard",
            data: {
              gameConversationId,
              leaderboard: finalLeaderboard,
              isCreator: player.visibleUserId === creator.visibleUserId,
            },
          },
          tags: {},
        });
      }
    });

    return {
      finalLeaderboard: finalLeaderboard.map((l) => ({
        rank: l.rank,
        username: l.username,
        score: l.score,
      })),
    };
  },
});
