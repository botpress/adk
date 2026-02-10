/**
 * @agent Brand Extractor Agent
 * @pattern Conversation + Background Workflow with Real-Time Progress UI
 *
 * WHY THIS AGENT EXISTS:
 * This agent extracts brand identity (colors, logo, themes) from any company website.
 * It demonstrates the "conversation-starts-workflow" pattern where the LLM handles user
 * interaction while a durable Workflow runs the heavy multi-step extraction in the background.
 *
 * ARCHITECTURE DECISIONS:
 * - Conversation + Workflow split: The conversation handler manages chat UX (greeting,
 *   clarification, status) while the Workflow handles the multi-step extraction pipeline
 *   (search, screenshot, vision analysis). This separation exists because extraction takes
 *   30-120 seconds — too long to block the conversation loop.
 * - Browser integration: Required for web search (finding company URLs), screenshot capture
 *   (visual brand analysis), and logo extraction. The browser integration provides headless
 *   browser actions as integration-level tools usable from workflows.
 * - Cerebras model for both autonomous and zai: Speed over depth. The conversational part
 *   is simple (ask for company, start extraction), and the heavy intelligence is in the
 *   workflow's vision analysis step which uses the cognitive API's "best" model directly.
 * - Real-time progress: The workflow updates a custom message component in the chat UI as
 *   each step completes, giving users visual feedback without polling.
 */
import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "demo-brand-extractor",
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
