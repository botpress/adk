import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "mulimodel",
  description: "An AI agent built with Botpress ADK",

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  dependencies: {
    integrations: {
      chat: { version: "chat@0.7.5", enabled: true },
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
