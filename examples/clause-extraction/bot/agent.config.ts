import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "clause-bot",
  description: "Contract clause extraction agent with risk assessment",

  defaultModels: {
    autonomous: "anthropic:claude-sonnet-4-5-20250929",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
