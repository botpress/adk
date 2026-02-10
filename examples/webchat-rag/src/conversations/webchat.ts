/**
 * @conversation Webchat RAG - Main Conversation Handler
 *
 * WHY IT'S BUILT THIS WAY:
 * This conversation handler is deliberately minimal — it composes behavior from extensions
 * rather than implementing logic inline. This demonstrates the "thin handler, fat extensions"
 * pattern for production agents.
 *
 * THE FOUR COMPOSE-ABLE BUILDING BLOCKS:
 *
 * 1. KNOWLEDGE (WebsiteKB):
 *    Passed to execute() via the `knowledge` parameter. This automatically provides the LLM
 *    with a search_knowledge tool. The LLM decides when to search, what query to use, and
 *    how to synthesize results — all handled by the ADK's built-in RAG pipeline.
 *
 * 2. OBJECTS (getAdminModeObject):
 *    Autonomous.Object groups related tools under a named namespace with a dynamic description.
 *    The admin object's description changes based on auth state ("ENABLED", "CODE GENERATED",
 *    etc.), and its tools change too (admin gets refreshKnowledgeBases, non-admin gets
 *    generateLoginCode or loginWithCode). This pattern — dynamic tool sets based on state —
 *    is more powerful than static tool lists.
 *
 * 3. GUARDRAILS (makeGuardrails):
 *    The onBeforeTool hook intercepts tool calls. Specifically, it blocks the LLM from
 *    sending a message (Message tool) if the user asked a question that requires knowledge
 *    search but the LLM hasn't searched yet. This forces the LLM to always check knowledge
 *    before answering questions, preventing hallucination.
 *
 * 4. LOGGING (onTraceLogging):
 *    The onTrace hook captures execution traces for error monitoring — logging code execution
 *    exceptions and failed tool calls to the console. This is a production observability
 *    pattern.
 *
 * WHY makeGuardrails TAKES message (not transcript):
 * This guardrail checks the current message specifically: "Is THIS message a question that
 * requires knowledge search?" Unlike the guardrails agent (which checks the full transcript
 * topic), this guardrail is per-message. It uses zai.learn("is_question") which caches the
 * learned check for performance.
 */
import { Conversation } from "@botpress/runtime";

import { WebsiteKB } from "../knowledge/website-docs";

import { getAdminModeObject } from "./extensions/admin-mode";
import { makeGuardrails } from "./extensions/guardrails";
import { onTraceLogging } from "./extensions/logging";

export default new Conversation({
  channel: ["chat.channel", "webchat.channel"],

  handler: async ({ execute, message }) => {
    // Initialize guardrail BEFORE execute() — starts the async check early
    const guardrail = makeGuardrails(message);

    await execute({
      instructions: `You are a helpful assistant that provides accurate information based on the Botpress documentation.`,
      knowledge: [WebsiteKB],
      objects: [getAdminModeObject()],
      hooks: {
        onBeforeTool: async (props) => guardrail.onBeforeToolGuard(props),
        onTrace: (props) => onTraceLogging!(props),
      },
    });
  },
});
