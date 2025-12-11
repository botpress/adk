import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "webchat-kitchen-sink",
  description: "Demo of frontend-bot communication patterns",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
