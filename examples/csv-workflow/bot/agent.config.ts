import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "csv-workflow",
  description:
    "CSV Import Pipeline - Upload, validate, and import CSV data with interactive error resolution",

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
