/**
 * @extension RAG Guardrail - Enforce Knowledge Search Before Answering
 * @pattern Pre-Message Validation Hook with Async Check
 *
 * WHY THIS GUARDRAIL EXISTS:
 * Without this guardrail, the LLM might answer documentation questions from its training
 * data (which may be outdated or incorrect) instead of searching the knowledge base first.
 * This guardrail intercepts the Message tool (the tool the LLM uses to send text to the
 * user) and blocks it if a knowledge search was required but not performed.
 *
 * HOW IT WORKS:
 * 1. When makeGuardrails is called (before execute), it starts an async check:
 *    "Does this user message require a knowledge search?"
 * 2. The check uses zai.learn("is_question").check() — the .learn() caches the check
 *    definition for reuse across messages, making subsequent checks faster.
 * 3. Inside the onBeforeTool hook, we track whether search_knowledge was called.
 * 4. When the LLM tries to send a Message:
 *    - If the message required knowledge search AND search hasn't happened -> block
 *    - Otherwise -> allow
 *
 * WHY onBeforeTool (not onBeforeExecution):
 * onBeforeExecution fires before the LLM even starts thinking. We want to let the LLM
 * think and potentially call search_knowledge first — we only need to block the final
 * Message tool if the LLM skipped the search. onBeforeTool fires right before each tool
 * execution, giving us precise control.
 *
 * WHY zai.learn("is_question") (not zai.check):
 * zai.learn() creates a reusable, cached check definition. The string "is_question" is
 * a cache key — subsequent calls with the same key reuse the learned check parameters.
 * This is faster than zai.check() which creates a new check definition each time.
 *
 * WHY hasSearched FLAG (not checking tool history):
 * The hook fires for every tool call but doesn't have access to previous tool calls.
 * The hasSearched flag tracks whether search_knowledge was called during this execute()
 * cycle. This is simpler and faster than inspecting the full execution trace.
 */
import { adk, Autonomous } from "@botpress/runtime";

export const makeGuardrails = (message: any) => {
  // Start the async check early — "Does this message need knowledge search?"
  // Uses zai.learn() for cached check definitions (faster on subsequent calls)
  const isKnowledgeSearchAsync = adk.zai
    .learn("is_question")
    .check(message, `Is this a question that requires knowledge search?`);

  // Track whether search_knowledge was called during this execute() cycle
  let hasSearched = false;

  const onBeforeToolGuard: Autonomous.Hooks["onBeforeTool"] = async ({
    tool,
  }: {
    tool: any;
  }) => {
    // Track when the LLM searches knowledge
    if (tool.name === "search_knowledge") {
      hasSearched = true;
    }

    // Block the Message tool if knowledge search was required but not performed
    const isKnowledgeSearch = await isKnowledgeSearchAsync;
    if (tool.name === "Message" && isKnowledgeSearch && !hasSearched) {
      console.warn(
        "Knowledge search required but not performed yet. Aborting message tool."
      );

      // Throwing here blocks the Message and tells the LLM to search first.
      // The LLM will see this error and call search_knowledge before retrying.
      throw new Error(
        `Knowledge search is required for this question, but was not performed. Please use the "search_knowledge" tool before answering.`
      );
    }
  };

  return {
    onBeforeToolGuard,
  };
};
