import { Conversation } from "@botpress/runtime";

import { WebsiteKB } from "../knowledge/website-docs";

import { getAdminModeObject } from "./extensions/admin-mode";
import { makeGuardrails } from "./extensions/guardrails";
import { onTraceLogging } from "./extensions/logging";

/**
 * Main conversation handler — ties together the knowledge base, admin mode,
 * guardrails, and logging. Listens on both chat and webchat channels.
 */
export default new Conversation({
  channel: ["chat.channel", "webchat.channel"],

  handler: async ({ execute, message }) => {
    const guardrail = makeGuardrails(message);

    await execute({
      instructions: `You are a helpful assistant that provides accurate information based on the Botpress documentation.`,

      // Passing a KB here gives the agent a built-in search_knowledge tool
      knowledge: [WebsiteKB],

      // Admin object provides conditional tools based on the user's auth state
      objects: [getAdminModeObject()],

      hooks: {
        // Guardrail: blocks the agent from responding without searching the KB first
        onBeforeTool: async (props) => guardrail.onBeforeToolGuard(props),
        // Logging: logs failed tool calls and code execution errors
        onTrace: (props) => onTraceLogging!(props),
      },
    });
  },
});
