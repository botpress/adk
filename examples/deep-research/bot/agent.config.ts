/**
 * @agent Deep Research Agent
 * @pattern Conversation-Guided Topic Refinement -> Long-Running Research Workflow
 *
 * WHY THIS AGENT EXISTS:
 * This agent conducts comprehensive research on any topic by searching the web, reading
 * pages, answering research questions, and assembling a structured report with citations.
 * It demonstrates the "guided handoff" pattern: the conversational LLM refines the research
 * topic through dialogue, then hands off to a durable workflow that autonomously executes
 * the multi-step research pipeline.
 *
 * ARCHITECTURE DECISIONS:
 * - Cerebras for autonomous: The conversation side is lightweight — topic clarification,
 *   confirming the research question, and acknowledging completion. Speed matters more than
 *   depth here. The heavy reasoning happens inside the workflow using zai and cognitive APIs.
 * - Browser integration: Required for web search (finding sources) and page fetching (reading
 *   full article content). The browser integration wraps headless browser capabilities into
 *   integration-level actions callable from workflows.
 * - 60-minute workflow timeout: Research involves searching, reading 15-25 web pages, and
 *   generating a multi-section report. Under normal conditions this takes 2-5 minutes, but
 *   slow websites or large topic scopes can extend it significantly.
 * - No tables/knowledge: Unlike clause-extraction, research results aren't persisted to
 *   tables because each research report is one-off. Results are returned as markdown directly
 *   in the workflow output and displayed via the progress UI component.
 */
import { defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "demo-deep-research",
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
