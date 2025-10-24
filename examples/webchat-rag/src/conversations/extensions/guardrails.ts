import { adk, Autonomous } from "@botpress/runtime";

export const makeGuardrails = (message: any) => {
  const isKnowledgeSearchAsync = adk.zai
    .learn("is_question")
    .check(message, `Is this a question that requires knowledge search?`);

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
