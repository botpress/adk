import { Table, z } from "@botpress/runtime";

/**
 * Activity Type Enum
 * Different stages of the extraction workflow
 */
export const ActivityType = z.enum([
  "reading",      // Reading document passages
  "extracting",   // Extracting clauses from passages
  "reviewing",    // Reviewing and consolidating clauses
  "storing",      // Storing results to database
  "summarizing",  // Generating contract summary
  "complete",     // Extraction complete
]);

/**
 * Activity Status Enum
 * Current state of each activity
 */
export const ActivityStatus = z.enum([
  "pending",
  "in_progress",
  "done",
  "error",
]);

/**
 * Extraction Activity Table
 * Tracks progress through the clause extraction workflow
 */
export default new Table({
  name: "extractionActivityTable",
  columns: {
    userId: z.string(), // Owner of this activity
    messageId: z.string(),
    contractId: z.number().optional(),
    type: ActivityType,
    status: ActivityStatus,
    text: z.string(),
    clauseType: z.string().optional(),
    metadata: z.string().optional(), // JSON string for flexible data
  },
});

export type ActivityType = z.infer<typeof ActivityType>;
export type ActivityStatus = z.infer<typeof ActivityStatus>;

export interface ExtractionActivity {
  id: string;
  userId: string;
  messageId: string;
  contractId?: number;
  type: ActivityType;
  status: ActivityStatus;
  text: string;
  clauseType?: string;
  metadata?: string;
}
