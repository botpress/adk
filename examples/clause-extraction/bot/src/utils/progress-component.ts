import { Message } from "@botpress/client";
import { context, z } from "@botpress/runtime";
import { listActivities } from "./activity-helpers";

/**
 * Re-export activity types for convenience
 */
export { ActivityType, ActivityStatus } from "../tables/extraction-activity";
export type { ExtractionActivity } from "../tables/extraction-activity";

/**
 * Extraction Status Enum
 */
export const ExtractionStatus = z.enum([
  "in_progress",
  "summarizing",
  "done",
  "errored",
  "cancelled",
]);

/**
 * Passage Stats Schema
 * Tracks passage processing progress
 */
export const PassageStatsSchema = z.object({
  total: z.number(),
  processed: z.number(),
  skipped: z.number(),
  withClauses: z.number(),
});

/**
 * Current Batch Schema
 * Info about the batch currently being processed
 */
export const CurrentBatchSchema = z.object({
  index: z.number(),
  total: z.number(),
  sectionHeader: z.string().optional(),
  passageCount: z.number(),
  pageRange: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
});

/**
 * Clause Schema for frontend display
 */
export const ClauseSchema = z.object({
  id: z.number(),
  clauseType: z.string(),
  title: z.string(),
  section: z.string().optional(),
  text: z.string(),
  keyPoints: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
});

/**
 * Extraction Progress Data Schema
 * Displayed in custom message component
 */
export const ExtractionData = z.object({
  progress: z.number().min(0).max(100),
  status: ExtractionStatus,
  topic: z.string(), // Document name
  clausesFound: z.number(),
  sources: z.array(z.object({
    fileId: z.string(),
    fileName: z.string(),
  })),
  activities: z.array(z.object({
    id: z.string(),
    messageId: z.string(),
    type: z.enum(["reading", "extracting", "reviewing", "storing", "summarizing", "complete"]),
    status: z.enum(["pending", "in_progress", "done", "error"]),
    text: z.string(),
    clauseType: z.string().optional(),
    metadata: z.string().optional(),
  })),
  error: z.string().optional(),
  // New fields for richer progress tracking
  passageStats: PassageStatsSchema.optional(),
  currentBatch: CurrentBatchSchema.optional(),
  // Clauses array - populated after extraction completes
  clauses: z.array(ClauseSchema).optional(),
  // Contract summary - populated after summarization phase
  summary: z.string().optional(),
});

export type ExtractionStatus = z.infer<typeof ExtractionStatus>;
export type ExtractionData = z.infer<typeof ExtractionData>;

/**
 * Creates a custom message component for extraction progress
 */
export async function createExtractionProgressComponent(
  initialData: ExtractionData
): Promise<Message> {
  const { message } = await context.get("client").createMessage({
    conversationId: context.get("conversation").id,
    userId: context.get("botId"),
    type: "custom",
    payload: {
      name: "extraction_progress",
      url: "custom://extraction_progress",
      data: initialData,
    },
    tags: {},
  });

  return message;
}

/**
 * Helper to check if status is final
 */
function isStatusFinal(status: string): boolean {
  return status === "done" || status === "errored" || status === "cancelled";
}

/**
 * Updates the extraction progress component with merge semantics
 * Fetches activities from table automatically
 */
export async function updateExtractionProgressComponent(
  messageId: string,
  userId: string,
  data: Partial<ExtractionData> & { topic: string }
): Promise<Message> {
  const client = context.get("client");

  const msg = await client.getMessage({ id: messageId });
  const existingData = msg.message.payload?.data as ExtractionData | undefined;

  // Don't update if already in final state
  if (existingData && isStatusFinal(existingData.status)) {
    return msg.message;
  }

  // Merge sources: add new sources without duplicates
  const existingSources = existingData?.sources || [];
  const newSources = data.sources || [];
  const existingFileIds = new Set(existingSources.map((s) => s.fileId));
  const mergedSources = [
    ...existingSources,
    ...newSources.filter((s) => !existingFileIds.has(s.fileId)),
  ];

  // Take max progress to avoid going backwards
  const mergedProgress = Math.max(
    existingData?.progress || 0,
    data.progress || 0
  );

  // Fetch activities from table (filtered by userId for security)
  const activities = await listActivities(messageId, userId);

  // Merge the data - new values override old, but sources and activities are merged
  const mergedData: ExtractionData = {
    progress: mergedProgress,
    status: data.status || existingData?.status || "in_progress",
    topic: data.topic,
    clausesFound: data.clausesFound ?? existingData?.clausesFound ?? 0,
    sources: mergedSources,
    activities,
    error: data.error || existingData?.error,
    // New fields - use latest values
    passageStats: data.passageStats || existingData?.passageStats,
    currentBatch: data.currentBatch || existingData?.currentBatch,
    // Clauses - only set when provided (typically at completion)
    clauses: data.clauses || existingData?.clauses,
    // Summary - only set when provided (after summarization)
    summary: data.summary || existingData?.summary,
  };

  const { message } = await client.updateMessage({
    id: messageId,
    payload: {
      name: "extraction_progress",
      url: "custom://extraction_progress",
      data: mergedData,
    },
    tags: {},
  });

  return message;
}
