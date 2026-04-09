import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "webchat-user-data",
  description:
    "Demonstrates passing user data from a website to the bot via webchat updateUser / getUserData",

  defaultModels: {
    autonomous: "openai:gpt-4.1-mini-2025-04-14",
    zai: "openai:gpt-4.1-mini-2025-04-14",
  },

  user: {
    state: z.object({
      jwt: z.string().optional().describe("JWT extracted from webchat user data"),
      email: z.string().optional().describe("Email extracted from webchat user data"),
      plan: z.string().optional().describe("Plan extracted from webchat user data"),
    }),
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
