import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "demo-deep-research",
  description: "An AI agent built with Botpress ADK",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
      browser: { version: "browser@0.8.1", enabled: true },
    },
  },
});
