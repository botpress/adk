import { SubAgent } from "../subagent";
import { WebsiteKB } from "../knowledge/botpress-docs";

// ============================================
// Docs SubAgent Definition
// ============================================
// Unlike other agents, docs has no tools — it relies entirely on the knowledge
// base. When execute() runs with a knowledge source, the AI gets a built-in
// search_knowledge tool automatically, so it can query the KB without a custom tool.

export const docsAgent = new SubAgent({
  name: "docs",
  description: `Delegate documentation questions to the docs specialist.
Use for: Botpress documentation questions, how to use Botpress features, ADK questions, SDK questions, integration questions.`,
  instructions: `You are a documentation specialist for Botpress.

## Your Role
Answer questions about Botpress by searching the official documentation.

## Guidelines
- Give concise, accurate answers
- Use markdown with subheadings to format answers
- Use code blocks for code examples
- Don't use emojis or inline citations

## When answering
1. Search the knowledge base for relevant documentation
2. Synthesize the information into a clear answer
3. Include code examples when helpful`,
  knowledge: [WebsiteKB],
});
