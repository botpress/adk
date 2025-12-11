import { Table, z } from "@botpress/runtime";

export const ActivitiesTable = new Table({
  name: "ActivitiesTable",
  description: "Tracks activities from fire-and-forget events and other demos",
  columns: {
    conversationId: z.string().describe("The conversation ID"),
    eventId: z.string().describe("Unique event identifier"),
    event: z
      .object({
        type: z.string(),
        payload: z.object({}).passthrough(),
      })
      .describe("The event data with type and payload"),
  },
});
