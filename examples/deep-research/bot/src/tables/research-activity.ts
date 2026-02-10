import { Table, z } from "@botpress/runtime";

/**
 * Activity types for the research workflow.
 * Used by the frontend to display appropriate icons.
 */
export const ActivityType = z.enum([
  "search",     // Web search activity
  "readPage",   // Reading a webpage
  "writing",    // Writing/drafting content
  "thinking",   // AI processing/thinking
  "pending",    // Queued activity not yet started
]);

export const ActivityStatus = z.enum([
  "pending",
  "in_progress",
  "done",
  "error",
]);

/**
 * Stores individual research activities (searches, page reads, writing steps, etc)
 * as table rows instead of embedding them in the progress message payload.
 *
 * This matters because the workflow researches sections in parallel via step.map —
 * multiple concurrent steps creating activities would race on the message payload.
 * With a table, each activity is its own row so updates never conflict.
 * The progress component reads all rows for a messageId on each UI update.
 */
export default new Table({
  name: "ResearchActivityTable",
  columns: {
    messageId: z.string(),
    type: ActivityType,
    status: ActivityStatus,
    text: z.string(),
    favicon: z.string().optional(),
    // Additional metadata as JSON string for flexibility
    metadata: z.string().optional(),
  },
});

// Type exports
export type ActivityType = z.infer<typeof ActivityType>;
export type ActivityStatus = z.infer<typeof ActivityStatus>;

export interface ResearchActivity {
  id: string;
  messageId: string;
  type: ActivityType;
  status: ActivityStatus;
  text: string;
  favicon?: string;
  metadata?: string;
}
