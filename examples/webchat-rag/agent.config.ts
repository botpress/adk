/**
 * @agent Webchat RAG Agent
 * @pattern RAG + Admin Mode + Guardrails (Composition Pattern)
 *
 * WHY THIS AGENT EXISTS:
 * This agent demonstrates how to compose multiple ADK patterns into a single production-ready
 * assistant. It combines: RAG (knowledge-based Q&A), admin mode (privileged operations with
 * code-based authentication), guardrails (ensure knowledge search before answering), and
 * trace logging (error monitoring). This is the closest to a "production template" among the
 * examples.
 *
 * ARCHITECTURE DECISIONS:
 *
 * - Cerebras for both models: The RAG pattern is simple — search knowledge, read passages,
 *   generate answer. Speed matters more than reasoning depth for documentation Q&A.
 *
 * - User state extends AdminModeUserSchema: Admin authentication state (code, expiry, admin
 *   status) is stored in user.state, which persists across conversations. This means once a
 *   user authenticates as admin, they retain access for 1 hour across all conversations —
 *   they don't need to re-authenticate if they open a new chat.
 *
 * - No explicit integrations in config: This agent doesn't declare webchat/chat in
 *   dependencies because it relies on the default integration resolution. The conversation
 *   handler explicitly lists ["chat.channel", "webchat.channel"] to support both.
 *
 * - Extension-based architecture: The conversation handler composes behavior from three
 *   independent extensions (admin-mode, guardrails, logging). Each extension is a separate
 *   file that can be added/removed independently. This is the recommended pattern for
 *   building production agents — start simple, add extensions as needed.
 *
 * WHY AdminModeUserSchema IS IMPORTED IN CONFIG (not just in the conversation):
 * User state schemas must be declared at the config level because they define the database
 * schema for user state persistence. The conversation handler reads/writes from this
 * persisted state, but the schema must be registered globally for the persistence layer.
 */
import { z, defineConfig } from "@botpress/runtime";
import { AdminModeUserSchema } from "./src/conversations/extensions/admin-mode";

export default defineConfig({
  name: "website-rag",
  description: "An AI agent built with Botpress ADK",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },

  bot: {},

  user: {
    state: z.object({}).extend(AdminModeUserSchema),
  },
});
