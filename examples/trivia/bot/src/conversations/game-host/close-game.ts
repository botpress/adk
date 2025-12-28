import { context, z } from "@botpress/runtime";
import { ConversationHandlerProps, ConversationHandlerResult } from "../types";

export const CloseGameRequestSchema = z.object({
  type: z.literal("close_game"),
});

export type CloseGameRequest = z.infer<typeof CloseGameRequestSchema>;

export type GameEndedEvent = {
  type: "game_ended";
  leaderboard: Array<{
    rank: number;
    visibleUserId: string;
    username: string;
    score: number;
  }>;
};

export async function handleCloseGame(
  props: ConversationHandlerProps
): Promise<ConversationHandlerResult> {
  const { client, conversation } = props;
  const botId = context.get("botId");

  console.log("[GameHost] Close game request received");

  // Check if game is in ended status (or playing - workflow might have finished)
  if (
    conversation.tags.status !== "playing" &&
    conversation.tags.status !== "ended"
  ) {
    console.warn(
      "[GameHost] Cannot close game - status is:",
      conversation.tags.status
    );
    return { handled: true, continue: false };
  }

  // Get the final leaderboard from the workflow state if available
  const workflowState = props.state.game;
  let leaderboard: GameEndedEvent["leaderboard"] = [];

  if (workflowState?.workflow?.output?.finalLeaderboard) {
    leaderboard = workflowState.workflow.output.finalLeaderboard;
  } else {
    // Fallback: build leaderboard from participants with 0 scores
    const { participants } = await client.listParticipants({
      id: conversation.id,
    });
    leaderboard = participants.map((p, index) => ({
      rank: index + 1,
      visibleUserId: p.id,
      username: p.name || p.id.slice(0, 8),
      score: 0,
    }));
  }

  // Update conversation status back to waiting
  conversation.tags.status = "waiting";

  // Broadcast game_ended event to all participants
  const event: GameEndedEvent = {
    type: "game_ended",
    leaderboard,
  };

  await client.createMessage({
    conversationId: conversation.id,
    userId: botId,
    type: "text",
    payload: { text: JSON.stringify(event) },
    tags: {},
  });

  console.log("[GameHost] Game ended, status updated to waiting");
  return { handled: true, continue: false };
}
