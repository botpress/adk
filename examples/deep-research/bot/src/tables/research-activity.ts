import { Table, z } from "@botpress/runtime";

/**
 * Activity types for the research workflow
 * Used by frontend to display appropriate icons
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
 * Research Activity Table
 * Stores individual activities for research workflows
 * Enables race-condition-free updates by allowing direct row updates
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
