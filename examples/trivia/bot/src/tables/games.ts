import { Table, z } from "@botpress/runtime";

/**
 * Game Settings Schema
 */
export const GameSettingsSchema = z.object({
  categories: z.array(z.string()).default(["any"]),
  difficulty: z.enum(["easy", "medium", "hard", "any"]).default("easy"),
  questionCount: z.number().min(5).max(50).default(10),
  scoreMethod: z
    .enum(["first-right", "time-right", "all-right"])
    .default("all-right"),
  timerSeconds: z.number().min(10).max(60).default(20),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;

/**
 * Player Schema (embedded in game)
 */
export const PlayerSchema = z.object({
  visibleUserId: z.string(),
  visibleConversationId: z.string(),
  username: z.string(),
  score: z.number().default(0),
  isCreator: z.boolean().default(false),
});

export type Player = z.infer<typeof PlayerSchema>;

/**
 * Question Schema (from Open Trivia DB)
 */
export const QuestionSchema = z.object({
  text: z.string(),
  type: z.enum(["true_false", "multiple_choice", "text_input"]),
  correctAnswer: z.string(),
  options: z.array(z.string()).optional(),
  category: z.string().optional(),
  difficulty: z.string().optional(),
});

export type Question = z.infer<typeof QuestionSchema>;

/**
 * Games Table
 *
 * Stores game state including players (embedded) and questions.
 * Max 20 players per game, so embedding is fine.
 */
export default new Table({
  name: "gamesTable",
  columns: {
    // Creator info
    visibleCreatorId: z.string(),
    visibleCreatorConversationId: z.string(),

    // Join code (6-char alphanumeric)
    joinCode: z.string(),

    // Game status
    status: z
      .enum(["waiting", "playing", "completed", "cancelled"])
      .default("waiting"),

    // Players (JSON array)
    players: z.string().default("[]"),

    // Game settings (JSON)
    settings: z.string(),

    // Questions (JSON array, populated after fetch)
    questions: z.string().default("[]"),

    // Current question index (0-indexed)
    currentQuestionIndex: z.number().default(0),

    // Workflow ID for the play-quiz workflow
    workflowId: z.string().optional(),
  },
});
