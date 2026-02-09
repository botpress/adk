import { z, defineConfig } from "@botpress/runtime";
import { AdminModeUserSchema } from "./src/conversations/extensions/admin-mode";

export default defineConfig({
  name: "website-rag",
  description: "An AI agent built with Botpress ADK",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {},

  user: {
    // Merge admin mode fields into user state so it persists per user (see admin-mode.ts)
    state: z.object({}).extend(AdminModeUserSchema),
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
      chat: { version: "chat@0.7.3", enabled: true },
      // browser integration is used by the website KB for crawling pages
      browser: { version: "browser@0.8.1", enabled: true },
    },
  },
});
