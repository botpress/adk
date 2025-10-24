import { Conversation } from "@botpress/runtime";
import { WebsiteKB } from "../knowledge/website-docs";
import { getAdminModeObject } from "./extensions/admin-mode";
import { makeGuardrails } from "./extensions/guardrails";
import { onTraceLogging } from "./extensions/logging";

export default new Conversation({
  channel: "*",
  handler: async ({ execute, message }) => {
    const guardrail = makeGuardrails(message);

    await execute({
      instructions: `You are a helpful assistant that provides accurate information based on the Botpress documentation.`,
      knowledge: [WebsiteKB],
      objects: [getAdminModeObject()],
      hooks: {
        onBeforeTool: async (props) => guardrail.onBeforeToolGuard(props),
        onTrace: (props) => onTraceLogging!(props),
      },
    });
  },
});
