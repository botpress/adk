import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "demo-deep-research",
  description: "An AI agent built with Botpress ADK",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  configuration: {
    schema: z.object({
      API_KEY: z.string().describe("API key for external research service"),
    }),
  },

  bot: {
    state: z.object({}),
    tags: {
      age: {
        title: "Age",
        description: "The age of the bot in years",
      },
    },
  },

  user: {
    state: z.object({}),
    tags: {
      subscriptionLevel: {
        title: "Subscription Level",
        description: "The user's subscription level",
      },
    },
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
      browser: { version: "browser@0.8.1", enabled: true },
    },
  },
});
