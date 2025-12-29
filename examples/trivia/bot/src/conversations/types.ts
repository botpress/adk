import { Conversation, Primitives, Reference, z } from "@botpress/runtime";
import { type Webchat } from "./index";

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
 * Player schema
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
