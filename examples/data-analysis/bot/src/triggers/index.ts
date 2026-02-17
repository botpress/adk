import { Trigger, context, actions, Zai} from "@botpress/runtime";

export default new Trigger({
  name: "allFrontendTriggers",
  events: ["chat:custom"],
  handler: async ({ event }) => {
    const logger = context.get("logger");
    const conversation = context.get('conversation');
    const eventType = event.payload.payload["type"] as string | undefined;
    if (eventType === "problemsTrigger") {
      logger.info("problems trigger triggered with payload: ", event.payload)
      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "problemsResponse"
        }
      })

    }else if(eventType === "polarityTrigger"){
      logger.info("polarity trigger triggered with payload: ", event.payload)

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "polarityResponse"
        }
      })

    }else if(eventType === "departmentTrigger"){
      logger.info("department trigger triggered with payload: ", event.payload)

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "departmentResponse"
        }
      })

    }
  },
});