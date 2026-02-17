import { Trigger, context, actions, Zai} from "@botpress/runtime";

export default new Trigger({
  name: "allFrontendTriggers",
  events: ["chat:custom"],
  handler: async ({ event }) => {
    const conversation = context.get('conversation');
    const eventType = event.payload.payload["type"] as string | undefined;
    if (eventType === "harmfulTrigger") {

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          eventType: "harmfulResponse"
        }
      })

    }else if(eventType === "imbalanceTrigger"){

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          eventType: "imbalanceResponse"
        }
      })

    }else if(eventType === "departmentTrigger"){

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          eventType: "departmentResponse"
        }
      })

    }
  },
});