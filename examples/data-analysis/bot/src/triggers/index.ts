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
      logger.info(`handling topics trigger for ${reviewsContent.length} reviews`)

      // split reviews into atomic topcis
      const atomicTopics = await Promise.all(
        reviewsContent.map(review => adk.zai.extract(review, z.array(z.object({
          atomic_feedback: z.string()
        }))))
      )
      
      // collect atomic topics into a list
      const atomicTopicList: string[] = [];
      atomicTopics.forEach((topic: {atomic_feedback: string}[]) => {
        for(const entry of topic){
          atomicTopicList.push(entry.atomic_feedback);
        }
      })

      // only keep the bad topics
      const badAtomicTopics = await adk.zai.filter(atomicTopicList, "is a customer issue for a hotel")
      
      // group bad topics together
      const groupedTopics = await adk.zai.group(badAtomicTopics, {
        instructions: "Group by type of customer issues"
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
      const sortedTopics = await adk.zai.sort(stringifiedTopics, "Sort these reviews by how much they hurt the business")
      const parsedSortedTopics = sortedTopics.map(topic => {
        const json = JSON.parse(topic);
        return {
          topic: json["topic"],
          reviews: json['related_reviews']
        }
      })

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "topicsResponse",
          data: parsedSortedTopics
        }
      })
      return

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

    }else{
      return;
    }
  },
});