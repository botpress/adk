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
    state: z.object({}).extend(AdminModeUserSchema),
  },
});
