import { context, z } from "@botpress/runtime";
import { ConversationHandlerProps, ConversationHandlerResult, Player } from "../types";
import PlayQuizWorkflow from "../../workflows/play-quiz";

export const StartGameRequestSchema = z.object({
  type: z.literal("start_game"),
});

export type StartGameRequest = z.infer<typeof StartGameRequestSchema>;

export type GameStartedEvent = {
  type: "game_started";
  settings: {
    categories: string[];
    difficulties: ("easy" | "medium" | "hard")[];
    questionCount: number;
    scoreMethod: "first-right" | "time-right" | "all-right";
    timerSeconds: number;
  };
};

export async function handleStartGame(
  props: ConversationHandlerProps
): Promise<ConversationHandlerResult> {
  const { client, conversation } = props;
  const botId = context.get("botId");

  console.log("[GameHost] Starting game request received");

  // Check if game is in waiting status
  if (conversation.tags.status !== "waiting") {
    console.warn(
      "[GameHost] Cannot start game - status is not waiting:",
      conversation.tags.status
    );
    return { handled: true, continue: false };
  }

  // Get participants to check count
  const { participants } = await client.listParticipants({
    id: conversation.id,
  });

  if (participants.length < 2) {
    console.warn(
      "[GameHost] Cannot start game - need at least 2 participants, got:",
      participants.length
    );
    return { handled: true, continue: false };
  }

  console.log(
    "[GameHost] Starting game with",
    participants.length,
    "participants"
  );

  // Update conversation status to playing
  conversation.tags.status = "playing";

  // Get game settings from conversation state
  const settings = props.state.settings ?? {
    categories: ["any"],
    difficulties: ["easy"] as ("easy" | "medium" | "hard")[],
    language: "english",
    questionCount: 10,
    scoreMethod: "all-right" as const,
    timerSeconds: 20,
  };

  // Build players list from participants
  const creatorUserId = conversation.tags.creatorUserId as string;
  const players: Player[] = participants.map((p) => ({
    visibleUserId: p.id,
    visibleConversationId: conversation.id,
    username: p.name || p.id.slice(0, 8),
    score: 0,
    isCreator: p.id === creatorUserId,
  }));

  console.log(
    "[GameHost] Players:",
    players.map((p) => ({ id: p.visibleUserId, isCreator: p.isCreator }))
  );
  console.log("[GameHost] Settings:", settings);

  // Start the play_quiz workflow
  props.state.game = await PlayQuizWorkflow.start({
    gameConversationId: conversation.id,
    players,
    settings,
  });

  console.log("[GameHost] Started workflow:", props.state.game.workflow.id);

  // Broadcast game_started event to all participants
  const event: GameStartedEvent = {
    type: "game_started",
    settings: {
      categories: settings.categories,
      difficulties: settings.difficulties,
      questionCount: settings.questionCount,
      scoreMethod: settings.scoreMethod,
      timerSeconds: settings.timerSeconds,
    },
  };

  await client.createMessage({
    conversationId: conversation.id,
    userId: botId,
    type: "text",
    payload: { text: JSON.stringify(event) },
    tags: {},
  });

  console.log("[GameHost] Game started, status updated to playing");
  return { handled: true, continue: false };
}
