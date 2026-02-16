import { Trigger, context } from "@botpress/runtime";

export default new Trigger({
  name: "event2Trigger",
  events: ["chat:custom"],
  handler: async ({ event }) => {
    const logger = context.get('logger');
    const eventType = event.payload["type"] as string | undefined;

    if (eventType === "event2") {
      logger.info("Received event2 - different handler!");
    }
  },
});
