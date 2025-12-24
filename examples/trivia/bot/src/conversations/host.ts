import { context } from "@botpress/runtime";

async function addPlayerToGame(props: { userId: string; code: string }) {
  const client = context.get("client");

  const { conversations } = await client.listConversations({
    tags: {
      code: props.code,
      status: "lobby",
    },
  });

  if (conversations.length === 0) {
    throw new Error("No active game found with the provided code.");
  }

  const gameConversation = conversations[0];

  const { conversations: convosToLeave } = await client.listConversations({
    participantIds: [props.userId],
  });

  const gameConvosToLeave = convosToLeave.filter((x) => x.tags.type === "game");

  if (gameConvosToLeave.length > 0) {
    await Promise.allSettled(
      gameConvosToLeave.map(async (convo) => {
        client.removeParticipant({
          userId: props.userId,
          id: convo.id,
        });
        // TODO: notify user they were removed from previous game
      })
    );
  }

  await client.addParticipant({
    id: gameConversation.id,
    userId: props.userId,
  });

  // TODO: notify user they joined the game
}

async function removePlayerFromGame(props: {
  userId: string;
  hostConversationId: string;
}) {
  //
}

async function createNewGame(props: { userId: string }): Promise<{
  hostConversationId: string;
  joinCode: string;
}> {
  const client = context.get("client");

  return { hostConversationId: "conv123", joinCode: "ABCDEF" };
}
