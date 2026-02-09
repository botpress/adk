import { adk, Autonomous } from "@botpress/runtime";

/**
 * Forces the AI to search the knowledge base before answering questions.
 * Without this, the AI might answer from its training data instead of the KB,
 * leading to hallucinated or outdated answers.
 */
export const makeGuardrails = (message: any) => {
  // Classify the message before the agent starts reasoning.
  // .check() asks the LLM the given question about the message and returns a boolean.
  // .learn() caches results so repeated messages skip the LLM.
  const isKnowledgeSearchAsync = adk.zai
    .learn("is_question")
    .check(message, `Is this a question that requires knowledge search?`);

  // Tracks whether search_knowledge has been called in this agent loop.
  // Reset per message because makeGuardrails is called per message.
  let hasSearched = false;

  const onBeforeToolGuard: Autonomous.Hooks["onBeforeTool"] = async ({
    tool,
  }: {
    tool: any;
  }) => {
    if (tool.name === "search_knowledge") {
      hasSearched = true;
    }

    const isKnowledgeSearch = await isKnowledgeSearchAsync;

    // "Message" is the built-in tool the agent uses to send a response.
    // If the agent tries to respond to a question without searching first,
    // throw an error — the agent will retry and call search_knowledge.
    if (tool.name === "Message" && isKnowledgeSearch && !hasSearched) {
      console.warn(
        "Knowledge search required but not performed yet. Aborting message tool."
      );

      throw new Error(
        `Knowledge search is required for this question, but was not performed. Please use the "search_knowledge" tool before answering.`
      );
    }
  };

  return {
    onBeforeToolGuard,
  };
};
