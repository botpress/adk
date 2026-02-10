/**
 * @agent Subagents (Multi-Agent Orchestrator)
 * @pattern Orchestrator-Worker with Isolated Execution Contexts
 *
 * WHY THIS AGENT EXISTS:
 * This agent demonstrates the multi-agent orchestrator pattern where a single "orchestrator"
 * LLM routes user requests to specialized "worker" subagents (HR, IT, Sales, Finance, Docs).
 * Each subagent runs in its own isolated execute() context with its own tools, instructions,
 * and knowledge bases — then returns structured results to the orchestrator.
 *
 * ARCHITECTURE DECISIONS:
 * - Orchestrator-Worker (not peer-to-peer): The orchestrator is the only agent that talks
 *   to the user. Subagents never produce user-facing messages — they return structured data
 *   (success/failure, results, follow-up questions). This keeps the UX consistent and
 *   prevents conflicting responses from multiple agents.
 * - Worker mode (`mode: "worker"` in execute): Subagents run in worker mode, which means
 *   they execute autonomously until they hit an Exit — no back-and-forth with the user.
 *   They can use tools, process data, and return results, but they can't send messages or
 *   ask the user questions directly. If they need more info, they return { needsInput: true }.
 * - Cerebras for all models: Speed is critical in a multi-agent system because the
 *   orchestrator-to-subagent round-trip adds latency. Using a fast model minimizes this.
 *   Subagent tasks are typically simple (check a balance, create a ticket) and don't need
 *   deep reasoning.
 * - Two channels (chat + webchat): Unlike most agents that only use webchat, this agent
 *   also supports the CLI chat integration for developer testing. The step() function
 *   adapts its output format based on channel.
 * - Empty bot/user state: State management happens at the subagent level (within each
 *   execute() call), not at the global level. Each subagent interaction is stateless.
 */
import { z, defineConfig } from "@botpress/runtime";

export default defineConfig({
  name: "subagents",
  description: "A multi-agent orchestrator-worker pattern example",

  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
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
      chat: { version: "chat@0.7.3", enabled: true },
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
