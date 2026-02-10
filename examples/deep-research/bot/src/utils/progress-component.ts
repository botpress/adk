import { Message } from "@botpress/client";
import { context, z } from "@botpress/runtime";
import { listActivities } from "./research-activity";

// Re-export activity types for convenience
export { ActivityType, ActivityStatus } from "../tables/research-activity";
export type { ResearchActivity } from "../tables/research-activity";

export const ResearchStatus = z.enum([
  "in_progress",
  "done",
  "errored",
  "cancelled",
]);

export const Source = z.object({
  favicon: z.string().optional(),
  url: z.string(),
  title: z.string(),
});

// Mirrors the table schema — the message payload needs a self-contained
// copy so the frontend gets everything without having to query the table
export const Activity = z.object({
  id: z.string(),
  messageId: z.string(),
  type: z.enum(["search", "readPage", "writing", "thinking", "pending"]),
  status: z.enum(["pending", "in_progress", "done", "error"]),
  text: z.string(),
  favicon: z.string().optional(),
  metadata: z.string().optional(),
});

export const ResearchData = z.object({
  title: z.string(),
  topic: z.string(),
  startedAt: z.string(),
  progress: z.number().min(0).max(100),
  activities: z.array(Activity),
  status: ResearchStatus,
  result: z.string().optional(), // Full markdown report
  summary: z.string().optional(), // Executive summary / TLDR
  sources: z.array(Source),
  error: z.string().optional(),
});

/**
 * Creates a custom message that the frontend renders as a research progress card.
 * Uses url "custom://research_progress" — the frontend's CustomTextRenderer
 * matches on this url to render the ResearchMessage component.
 */
export async function createResearchProgressComponent(
  initialData: z.infer<typeof ResearchData>
): Promise<Message> {
  const { message } = await context.get("client").createMessage({
    conversationId: context.get("conversation").id,
    userId: context.get("botId"),
    type: "custom",
    payload: {
      name: "research_progress",
      url: "custom://research_progress",
      data: initialData,
    },
    tags: {},
  });

  return message;
}

function isStatusFinal(status: string) {
  return status === "done" || status === "errored" || status === "cancelled";
}

/**
 * Updates the progress message with new data. Designed for concurrent callers:
 * - Sources are merged (deduplicated by URL) so parallel sections accumulate sources
 * - Progress only goes forward (takes the max) so out-of-order updates don't regress
 * - Activities are fetched fresh from the ResearchActivityTable each call
 * - Skips the update entirely if the message is already in a terminal state
 */
export async function updateResearchProgressComponent(
  messageId: string,
  data: Partial<z.infer<typeof ResearchData>> & { topic: string }
): Promise<Message> {
  const client = context.get("client");

  const msg = await client.getMessage({ id: messageId });
  const existingData = msg.message.payload?.data as z.infer<typeof ResearchData> | undefined;

  // Don't update if already in final state
  if (existingData && isStatusFinal(existingData.status)) {
    return msg.message;
  }

  // Merge sources: add new sources without duplicates
  const existingSources = existingData?.sources || [];
  const newSources = data.sources || [];
  const existingUrls = new Set(existingSources.map(s => s.url));
  const mergedSources = [
    ...existingSources,
    ...newSources.filter(s => !existingUrls.has(s.url))
  ];

  // Take max progress to avoid going backwards
  const mergedProgress = Math.max(
    existingData?.progress || 0,
    data.progress || 0
  );

  // Fetch activities from table
  const activities = await listActivities(messageId);

  // Merge the data - new values override old, but sources are merged
  const mergedData: z.infer<typeof ResearchData> = {
    title: data.title || existingData?.title || `Research on ${data.topic}`,
    topic: data.topic,
    startedAt: existingData?.startedAt || data.startedAt || new Date().toISOString(),
    progress: mergedProgress,
    activities,
    status: data.status || existingData?.status || "in_progress",
    sources: mergedSources,
    result: data.result || existingData?.result,
    summary: data.summary || existingData?.summary,
    error: data.error || existingData?.error,
  };

  const { message } = await client.updateMessage({
    id: messageId,
    payload: {
      name: "research_progress",
      url: "custom://research_progress",
      data: mergedData,
    },
    tags: {},
  });

  return message;
}

// Type exports for use in handlers
export type ResearchStatus = z.infer<typeof ResearchStatus>;
export type Source = z.infer<typeof Source>;
export type Activity = z.infer<typeof Activity>;
export type ResearchData = z.infer<typeof ResearchData>;
