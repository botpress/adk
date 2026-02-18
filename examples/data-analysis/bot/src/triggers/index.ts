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

    // saved here because reused accross many workflows.
    const atomicTopicList: string[] = [];
    if(eventType === "topicsTrigger" || eventType === "polarityTrigger" || eventType === "departmentTrigger"){
      // split reviews into atomic topcis
      const atomicTopics = await Promise.all(
        reviewsContent.map(review => adk.zai.extract(review, z.array(z.object({
          atomic_feedback: z.string()
        }))))
      )
      
      // collect atomic topics into a list
      atomicTopicList.push(...atomicTopics.flatMap(topic => topic.map(entry => entry.atomic_feedback)))
    }

    if (eventType === "topicsTrigger") {
      logger.info(`handling topics trigger for ${reviewsContent.length} reviews`)

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
      logger.info(`handling POLARITY trigger for ${reviewsContent.length} reviews`)

      // group the atomic reviews in medium size topics
      const groupedTopics = await adk.zai.group(atomicTopicList, {
        instructions: "Group by hotel aspect. Assign each review to the most relevant group.",
        initialGroups: [
          { id: "cleanliness", label: "Cleanliness" },
          { id: "location", label: "Location" },
          { id: "staff", label: "Staff & Service" },
          { id: "food", label: "Food & Dining" },
          { id: "amenities", label: "Amenities (Pool, Gym, Spa)" },
          { id: "value", label: "Value for Money" },
          { id: "noise", label: "Noise & Quietness" },
          { id: "checkin", label: "Check-in & Check-out" },
          { id: "room", label: "Room Comfort & Size" },
          { id: "wifi", label: "WiFi & Technology" }
        ]
      })

      // group reviews within groups into good or bad and rate 
      const structuredGroups = await Promise.all(Object.entries(groupedTopics).map(async ([label, reviews]) => {
        const goodOrBad = await adk.zai.group(reviews, {
          instructions: "by good or bad, no neutral",
          initialGroups: [{id: "good",label: "good"},{id: "bad", label: "bad"}]
        })

        const goodReviews = goodOrBad.good ? goodOrBad.good: [];
        const badReviews = goodOrBad.bad ? goodOrBad.bad : [];
        const goodReviewsScores = await adk.zai.rate(goodReviews, "Rate the sentiment intensity of these reviews, scale them between 0 and 10. 0 means indifferent, empty, or neutral. 10 means passionate, intense, strong")
        const badReviewsScores = await adk.zai.rate(badReviews, "Rate the sentiment intensity of these reviews, scale them between 0 and 10. 0 means indifferent, empty, or neutral. 10 means passionate, intense, strong")
        const positiveScore = goodReviewsScores.reduce((a, b) => a + b, 0)
        const negativeScore = badReviewsScores.reduce((a, b) => a + b, 0)
        
        return {
          topic: label,
          positiveReviews: goodReviews,
          negativeReviews: badReviews,
          positiveScore: positiveScore,
          negativeScore: negativeScore,
          polarityScore: positiveScore / (positiveScore + negativeScore) || 1
        }
      }))

      // Sort by most polarized first (furthest from 50/50 split)
      structuredGroups.sort((a, b) => Math.abs(b.polarityScore - 0.5) - Math.abs(a.polarityScore - 0.5))

      await actions.chat.sendEvent({
        conversationId: conversation.id,
        payload:{
          type: "polarityResponse",
          data: structuredGroups
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