import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "trivia-quiz",
  description:
    "Multiplayer trivia quiz game - create or join games, answer timed questions, compete for the top score!",

  defaultModels: {
    autonomous: "anthropic:claude-sonnet-4-5-20250929",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({
      username: z.string().optional(),
    }),
  },

  dependencies: {
    integrations: {
      delegate: { version: "agi/delegate@0.1.0", enabled: true },
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
