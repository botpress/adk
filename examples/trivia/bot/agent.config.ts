import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "trivia-quiz",
  description:
    "Multiplayer trivia quiz game - create or join games, answer timed questions, compete for the top score!",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({
      username: z.string().optional(),
      currentGameCode: z.string().optional(),
    }),
  },

  conversation: {
    tags: {
      creatorUserId: {
        title: "Creator User ID",
        description: "The user ID of the game creator",
      },
      type: {
        title: "Conversation Type",
        description: "The type of conversation (lobby or game)",
      },
      status: {
        title: "Game Status",
        description: "The current status of the trivia game",
      },
      code: {
        title: "Game Code",
        description: "The join code for the trivia game",
      },
    },
  },

  dependencies: {
    integrations: {
      delegate: { version: "agi/delegate@0.1.0", enabled: true },
      webchat: {
        version: "webchat@0.3.0",
        enabled: true,
      },
    },
  },
});
