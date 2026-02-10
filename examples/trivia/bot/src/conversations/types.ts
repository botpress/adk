/**
 * @types Trivia Game Type System
 *
 * WHY THESE TYPES EXIST:
 * The trivia game has complex type relationships: conversation handler props flow through
 * the chain of responsibility, game state tracks players and settings, and the partial
 * handler pattern requires a standardized return type.
 *
 * WHY ConversationHandlerResult HAS handled + continue:
 * The chain of responsibility pattern requires three possible outcomes:
 * - { handled: true, continue: false } — I handled it, stop processing
 * - { handled: true, continue: true } — I did some work, but keep going (middleware)
 * - { handled: false } — Not my message, try the next handler
 * A simple boolean wouldn't capture the middleware case.
 *
 * WHY ConversationState INCLUDES Reference.Workflow:
 * The game state includes a live reference to the play_quiz workflow. This allows the
 * conversation handler to check workflow status (is the game still running?) and access
 * workflow output (final scores) without making API calls.
 *
 * WHY ExtractTypes USES TypeScript INFERENCE (not manual types):
 * The type ExtractTypes extracts channel, state, and events types from the Webchat
 * conversation definition automatically. This ensures ConversationHandlerProps stays in
 * sync with the actual conversation definition — if you add a new event type, the handler
 * props update automatically.
 */
import { Conversation, Primitives, Reference, z } from "@botpress/runtime";
import { type Webchat } from "./index";

// Extract types from the Webchat conversation definition automatically — ensures handler
// props stay in sync with the actual conversation config
type ExtractTypes =
  typeof Webchat extends Conversation<infer C, infer S, infer E>
    ? { channel: C; state: S; events: E }
    : never;

export type ConversationHandlerProps = Primitives.Conversation.HandlerProps<
  ExtractTypes["channel"],
  ExtractTypes["state"],
  ExtractTypes["events"]
>;

export type ConversationHandlerResult =
  | {
      handled: true;
      continue: boolean;
    }
  | {
      handled: false;
    };

/**
 * Player schema — represents a participant in the game with their score and metadata
 */
const PlayerSchema = z.object({
  visibleUserId: z.string(),
  visibleConversationId: z.string(),
  username: z.string(),
  score: z.number().default(0),
  isCreator: z.boolean().default(false),
});

export type Player = z.infer<typeof PlayerSchema>;
export { PlayerSchema };

/**
 * Game settings schema
 */
export const GameSettingsSchema = z.object({
  categories: z.array(z.string()).default(["any"]),
  /** Array of difficulties to include. Questions will be mixed from each selected difficulty. */
  difficulties: z.array(z.enum(["easy", "medium", "hard"])).default(["easy"]),
  language: z.string().default("english"),
  questionCount: z.number().min(5).max(50).default(10),
  scoreMethod: z
    .enum(["first-right", "time-right", "all-right"])
    .default("all-right"),
  timerSeconds: z.number().min(5).max(60).default(20),
});

export type GameSettings = z.infer<typeof GameSettingsSchema>;

/**
 * Conversation state for trivia game
 */
export const ConversationState = z.object({
  settings: GameSettingsSchema.optional(),
  game: Reference.Workflow("play_quiz").optional(),
});

export type PartialHandler = (
  props: ConversationHandlerProps
) => Promise<ConversationHandlerResult>;
