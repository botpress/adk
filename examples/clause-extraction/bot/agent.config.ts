/**
 * @agent Clause Extraction Agent
 * @pattern File Upload -> Workflow Pipeline -> Interactive Q&A
 *
 * WHY THIS AGENT EXISTS:
 * This agent extracts, categorizes, and risk-assesses contractual clauses from uploaded
 * legal documents. It demonstrates the most complex ADK pattern: file upload handling,
 * background workflow processing, database persistence, and post-extraction Q&A — all
 * with real-time progress tracking.
 *
 * ARCHITECTURE DECISIONS:
 * - Claude Sonnet for autonomous (not Cerebras): Legal contract analysis requires deep
 *   reasoning — understanding clause implications, risk assessment relative to which party
 *   the user represents, and nuanced categorization. Cerebras is fast but less reliable for
 *   complex legal reasoning. Sonnet was chosen for accuracy over speed.
 * - Cerebras for zai: The zai model handles simpler tasks (text extraction from passages,
 *   summarization) where speed matters and reasoning depth is less critical.
 * - bot + user state in config: Both are z.object({}) — intentionally empty. The real state
 *   lives in conversation state (uploaded files, workflow references, party selection).
 *   The empty bot/user state declarations exist to enable future extension without config
 *   migration.
 * - No browser integration: Unlike brand-extractor and deep-research, this agent works with
 *   uploaded files (not web content), so it only needs the webchat integration for file uploads.
 * - Tables for persistence: Extracted clauses and contracts are stored in ADK Tables (not
 *   just in-memory), enabling structured querying, filtering, and full-text search post-extraction.
 */
import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "demo-clause-extraction",
  description: "Contract clause extraction agent with risk assessment",

  defaultModels: {
    autonomous: "anthropic:claude-sonnet-4-5-20250929",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {
    state: z.object({}),
  },

  user: {
    state: z.object({}),
  },

  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
