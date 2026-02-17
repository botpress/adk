import { Trigger, context, actions, Zai} from "@botpress/runtime";

export default new Trigger({
  name: "allFrontendTriggers",
  events: ["chat:custom"],
  handler: async ({ event }) => {
    const conversation = context.get('conversation');
    const logger = context.get('logger');
    const eventType = event.payload.payload["type"] as string | undefined;
    if (eventType === "harmfulTrigger") {
      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          eventType: "harmfulResponse"
        }
      })
    }else if(eventType === "imbalanceTrigger"){

    }else if(eventType === "departmentTrigger"){

    }
  },
});