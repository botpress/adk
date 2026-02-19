import { Trigger, context, actions, adk, z } from "@botpress/runtime";

// Get formatted timestamp for logging
function timestamp() {
  return new Date().toISOString()
}

// a review might mention many topics, some good, some bad, so we split them with zai.extract()
async function extractAtomicTopics(reviewsContent: string[]): Promise<string[]> {
  const atomicTopics = await Promise.all(
    reviewsContent.map(review => adk.zai.extract(review, z.array(z.object({
      atomic_feedback: z.string()
    }))))
  )
  return atomicTopics.flatMap(topic => topic.map(entry => entry.atomic_feedback))
}

// Business critical analysis: only consider bad feedback, group them by similarity, sort by harm to business
async function analyzeIssues(atomicTopicList: string[], conversationId: string) {
  const logger = context.get("logger")
  logger.info(`[${timestamp()}] analyzeIssues START`)

  const badFeedback = await adk.zai.filter(atomicTopicList, "is a customer issue for a hotel")

  // group by customer issues
  const groupedIssues = await adk.zai.group(badFeedback, {
    instructions: "Group by type of customer issues"
  })

  // stringify groups so that we can sort them
  const stringifiedIssues = Object.entries(groupedIssues).map(([issue, reviews]) => {
    return JSON.stringify({
      topic: issue,
      related_reviews: reviews,
      number_of_mentions: reviews.length
    })
  })

  // sort the groups by business harm
  const sortedIssues = await adk.zai.sort(stringifiedIssues, "Sort these reviews by how much they hurt the business")

  // revert the stringification and structure the results into what the client wants
  const parsedSortedIssues = sortedIssues.map(issue => {
    const json = JSON.parse(issue);
    return { topic: json["topic"], reviews: json['related_reviews'] }
  })

  // send event with results to client
  await actions.chat.sendEvent({
    conversationId,
    payload: { type: "issuesResponse", data: parsedSortedIssues }
  })

  logger.info(`[${timestamp()}] analyzeIssues END`)
}

// Polarity analysis: split similar topics into groups, further split each group into subgroups for good and bad, zai.rate the reviews and sum the scores
async function analyzePolarity(atomicTopicList: string[], conversationId: string) {
  const logger = context.get("logger")
  logger.info(`[${timestamp()}] analyzePolarity START`)

  // initialGroups to set the tone for the size of each group so that we dont have a lot of groups with 1 or 2 reviews
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
    ]
  })

  // split each group into two subgroups 
  const structuredGroups = await Promise.all(Object.entries(groupedTopics).map(async ([label, reviews]) => {
    const goodOrBad = await adk.zai.group(reviews, {
      instructions: "by good or bad, no neutral",
      initialGroups: [{id: "good", label: "good"}, {id: "bad", label: "bad"}]
    })

    const goodReviews = goodOrBad.good ?? []
    const badReviews = goodOrBad.bad ?? []

    // rate the severity of each review
    const goodReviewsScores = await adk.zai.rate(goodReviews, "Rate the sentiment intensity of these reviews, scale them between 0 and 10. 0 means indifferent, empty, or neutral. 10 means passionate, intense, strong")
    const badReviewsScores = await adk.zai.rate(badReviews, "Rate the sentiment intensity of these reviews, scale them between 0 and 10. 0 means indifferent, empty, or neutral. 10 means passionate, intense, strong")
    
    // sum the ratings for overall score
    const positiveScore = goodReviewsScores.reduce((a, b) => a + b, 0)
    const negativeScore = badReviewsScores.reduce((a, b) => a + b, 0)

    return {
      topic: label,
      positiveReviews: goodReviews,
      negativeReviews: badReviews,
      positiveScore,
      negativeScore,
      polarityScore: positiveScore / ((positiveScore + negativeScore) || 1)
    }
  }))

  // compute the split scale
  structuredGroups.sort((a, b) => Math.abs(b.polarityScore - 0.5) - Math.abs(a.polarityScore - 0.5))

  // send event with results to client
  await actions.chat.sendEvent({
    conversationId,
    payload: { type: "polarityResponse", data: structuredGroups }
  })

  logger.info(`[${timestamp()}] analyzePolarity END`)
}

// Department analysis: split reviews into department groups, user can provide their own departments,
async function analyzeDepartments(atomicTopicList: string[], conversationId: string, customDepartments?: string[]) {
  const logger = context.get("logger")
  logger.info(`[${timestamp()}] analyzeDepartments START`)

  const defaultDepartments = [
    { id: "frontdesk", label: "Front Desk" },
    { id: "housekeeping", label: "Housekeeping" },
    { id: "restaurant", label: "Restaurant" },
    { id: "events", label: "Events" },
    { id: "maintenance", label: "Maintenance and Facilities" },
    { id: "recreation", label: "Recreation" },
    { id: "parking", label: "Parking" }
  ]

  // choose between default departments or user provided departments
  const initialGroups = customDepartments
    ? customDepartments.map(dept => ({ id: dept, label: dept }))
    : defaultDepartments

  // group reviews by department
  const groupedByDepartment = await adk.zai.group(atomicTopicList, {
    instructions: "Group reviews by the department responsible for handling the issue or feedback mentioned",
    initialGroups
  })

  // score each department by taking the average rating of each review. 
  const departmentScores = await Promise.all(Object.entries(groupedByDepartment).map(async ([department, reviews]) => {
    const scores = await adk.zai.rate(reviews, "Rate how positive this feedback is.")
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    return { department, score: avgScore, reviews }
  }))

  // send event with results to client
  await actions.chat.sendEvent({
    conversationId,
    payload: { type: "departmentsResponse", data: departmentScores }
  })

  logger.info(`[${timestamp()}] analyzeDepartments END`)
}

// Single trigger handling all analysis events
export const AnalysisTrigger = new Trigger({
  name: "analysisTrigger",
  events: ["chat:custom"],
  handler: async ({ event }) => {
    const logger = context.get("logger")
    const conversation = context.get('conversation')
    const payload = event.payload.payload
    const eventType = payload["type"]

    logger.info(`Received event type: ${eventType}`)

    if (eventType === "fullAnalysisTrigger") {
      // Full analysis: topics + polarity + departments
      const reviews = payload["reviews"] as {content: string}[]
      const reviewsContent = reviews.map(r => r.content)

      logger.info(`[${timestamp()}] Running full analysis for ${reviewsContent.length} reviews`)

      const atomicTopicList = await extractAtomicTopics(reviewsContent)
      logger.info(`[${timestamp()}] extractAtomicTopics complete (${atomicTopicList.length} atomic topics)`)

      await Promise.all([
        analyzeIssues(atomicTopicList, conversation.id),
        analyzePolarity(atomicTopicList, conversation.id),
        analyzeDepartments(atomicTopicList, conversation.id)
      ])

      logger.info(`[${timestamp()}] Full analysis complete`)
    } else if (eventType === "departmentTrigger") {
      // Department-only analysis (manual regeneration with custom departments)
      const reviews = payload["reviews"] as {content: string}[]
      const reviewsContent = reviews.map(r => r.content)
      const departments = payload["departments"] as string[] | undefined

      logger.info(`[${timestamp()}] Running department analysis for ${reviewsContent.length} reviews with custom departments: ${departments?.join(', ') ?? 'default'}`)

      const atomicTopicList = await extractAtomicTopics(reviewsContent)
      logger.info(`[${timestamp()}] extractAtomicTopics complete`)

      await analyzeDepartments(atomicTopicList, conversation.id, departments)
      logger.info(`[${timestamp()}] Department analysis complete`)
    }
  },
})