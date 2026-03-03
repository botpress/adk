import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "parallel-document-processing",
  description:
    "Demonstrates parallel ADK workflows — the same analysis workflow running as multiple instances simultaneously",

  defaultModels: {
    autonomous: "best",
    zai: "best",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  events: {
    upsertAnalyzer: {
      description: "Upserting an analyzer",
      schema: z.object({
        id: z.string(),
        name: z.string(),
        instructions: z.string(),
      }),
    },
  },

  dependencies: {
    integrations: {
      chat: { version: "chat@0.7.3", enabled: true },
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
