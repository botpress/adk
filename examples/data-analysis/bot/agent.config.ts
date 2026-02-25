import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "bot",
  description: "An AI agent built with Botpress ADK",

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({
      atomicReviews: z.array(z.string()).default([])
    }),
  },

  dependencies: {
    integrations: {
      chat: { version: "chat@0.7.4", enabled: true },
    },
  },
});
