/**
 * @agent Guardrails Agent
 * @pattern Pre-Execution Topic Validation with zai.check
 *
 * WHY THIS AGENT EXISTS:
 * This agent demonstrates how to enforce topic boundaries on an AI conversation. The agent
 * ONLY talks about Botpress — if the user tries to discuss cooking, sports, or anything
 * off-topic, the agent detects this and redirects the conversation. This pattern is essential
 * for enterprise deployments where the agent must stay within its designated domain.
 *
 * ARCHITECTURE DECISIONS:
 * - Minimal config: Like the approval agent, this agent keeps its config minimal to showcase
 *   the guardrail pattern without distractions.
 * - Cerebras model: The guardrail check (zai.check) runs concurrently with the LLM response
 *   generation. Using a fast model for both means the guardrail doesn't add noticeable latency.
 * - No state: Guardrails are stateless — each message is evaluated independently against the
 *   full transcript. No need to persist guardrail decisions across messages.
 * - Single integration (webchat): The guardrail pattern works on any channel, but webchat
 *   supports the custom "TopicError" UI component for visual feedback.
 *
 * KEY PATTERN — ASYNC GUARDRAIL:
 * The guardrail check (zai.check) is fired BEFORE execute() and runs concurrently. Inside
 * the onBeforeExecution hook, the result is awaited. This means the guardrail check runs in
 * parallel with the LLM's first thinking step, adding zero latency to the happy path. Only
 * when the guardrail fails does it interrupt execution.
 */
import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "guardrails",
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
