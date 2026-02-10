/**
 * @agent Approval Agent
 * @pattern Human-in-the-Loop Tool Execution
 *
 * WHY THIS AGENT EXISTS:
 * This agent demonstrates how to add a user approval gate before executing any tool.
 * In production AI systems, certain actions (e.g., making purchases, modifying data,
 * sending emails) should NOT execute autonomously — they require explicit human consent.
 * This pattern solves the "trust boundary" problem: the LLM decides WHAT to do, but the
 * human confirms WHETHER it actually happens.
 *
 * ARCHITECTURE DECISIONS:
 * - Minimal config: This agent deliberately uses the simplest possible configuration to
 *   isolate and showcase the approval pattern without distractions.
 * - Single integration (webchat): Approval UX relies on interactive buttons for
 *   approve/reject, which webchat supports natively.
 * - Cerebras model: Chosen for low latency on a pattern that involves multiple LLM
 *   round-trips (propose -> wait -> re-execute), where speed matters more than reasoning depth.
 * - No bot/user state in config: State is handled inside the conversation via
 *   ToolWithApproval.ApprovalState, keeping the config clean and the approval logic
 *   self-contained within the conversation handler.
 */
import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "approval",
  description: "An AI agent built with Botpress ADK",

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
