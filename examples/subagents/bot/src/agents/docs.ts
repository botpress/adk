/**
 * @subagent Docs Agent
 * @pattern Knowledge-Powered Specialist (RAG subagent)
 *
 * WHY THIS SUBAGENT IS DIFFERENT FROM THE OTHERS:
 * The docs agent has NO tools — instead it has a Knowledge base (WebsiteKB). When a subagent
 * has knowledge, the execute() call automatically provides a search_knowledge tool that the
 * LLM can use to search the knowledge base. This makes the docs agent a pure RAG (Retrieval-
 * Augmented Generation) specialist: it searches documentation, reads relevant passages, and
 * synthesizes answers.
 *
 * WHY A SEPARATE SUBAGENT FOR DOCS (not just adding knowledge to the orchestrator):
 * 1. Isolation: The docs agent has its own instructions optimized for documentation Q&A.
 *    The orchestrator would need generic instructions that work for all domains.
 * 2. Context budget: Knowledge search results consume context tokens. By isolating docs
 *    in its own execute(), the retrieved passages don't pollute the orchestrator's context
 *    window, leaving more room for the orchestrator to handle other tasks.
 * 3. Reusability: The docs agent config can be reused in other multi-agent setups.
 */
import { SubAgent } from "../subagent";
import { WebsiteKB } from "../knowledge/botpress-docs";

// ============================================
// Docs SubAgent Definition — Uses knowledge (RAG) instead of tools.
// The execute() call automatically provides a search_knowledge tool
// when a Knowledge base is passed via the knowledge parameter.
// ============================================

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
