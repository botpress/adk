import { Trigger, context, actions, adk, z} from "@botpress/runtime";

export default new Trigger({
  name: "allFrontendTriggers",
  events: ["chat:custom"],
  handler: async ({ event }) => {
    const logger = context.get("logger");
    const conversation = context.get('conversation');

    const payload = event.payload.payload;
    const eventType = payload["type"] as string | undefined;

    const reviews = payload["reviews"] as {content: string}[];
    const reviewsContent : string[] = reviews.map((reviewObject) => {
      return reviewObject["content"] as string;
    })

    if (eventType === "topicsTrigger") {
      logger.info("topics trigger triggered")

      // // split reviews into atomic topcis
      // const atomicTopics = await Promise.all(
      //   reviewsContent.map(review => adk.zai.extract(review, z.array(z.object({
      //     atomic_feedback: z.string()
      //   }))))
      // )

      // group topics together
      const groupedTopics = await adk.zai.group(reviewsContent, {
        instructions: "Group these reviews by similar topics"
      })

      // stringify topics because sort takes string[]
      const stringifiedTopics = Object.entries(groupedTopics).map(([specificTopic, reviews]) => {
        return JSON.stringify({
          topic: specificTopic,
          related_reviews: reviews,
          number_of_mentions: reviews.length
        })
      });

      // sort the topics
      // const sortedTopics = await adk.zai.sort(stringifiedTopics, "Sort these reviews by ")
      // const parsedSortedTopics = sortedTopics.map(topic => {
      //   const json = JSON.parse(topic);
      //   return {
      //     topic: json["topic"],
      //     number_of_mentions: json["number_of_mentions"],
      //     reviews: json['related_reviews']
      //   }
      // })

      // rate the topics
      const ratedTopics = await adk.zai.rate(stringifiedTopics, "Rate these topics by how harmful they are to the hotel business.")

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "topicsResponse",
          data: parsedSortedTopics
        }
      })

    }else if(eventType === "polarityTrigger"){
      logger.info("polarity trigger triggered")

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "polarityResponse"
        }
      })

    }else if(eventType === "departmentTrigger"){
      logger.info("department trigger triggered")

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "departmentResponse"
        }
      })

    }
  },
});