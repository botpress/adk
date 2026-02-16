import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "bot",
  description: "An AI agent built with Botpress ADK",

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  dependencies: {
    integrations: {
      chat: { version: "chat@0.2.0", enabled: true },
    },
  },
});
