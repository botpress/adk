import { context } from "@botpress/runtime";
import type {
  ActivityType,
  ActivityStatus,
  ResearchActivity,
} from "../tables/research-activity";

/**
 * Helper functions for managing research activities in the table
 * These provide a clean API for creating, updating, and listing activities
 */

/**
 * Creates a new research activity and returns its ID for future updates
 */
export async function createActivity(opts: {
  messageId: string;
  type: ActivityType;
  status: ActivityStatus;
  text: string;
  favicon?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const client = context.get("client");

  const { rows } = await client.createTableRows({
    table: "ResearchActivityTable",
    rows: [
      {
        messageId: opts.messageId,
        type: opts.type,
        status: opts.status,
        text: opts.text,
        favicon: opts.favicon,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : undefined,
      },
    ],
  });

  const row = rows[0];
  if (!row?.id) {
    throw new Error("Failed to create activity row");
  }

  return row.id.toString();
}

/**
 * Updates an existing activity by its ID
 * All fields are optional - only provided fields will be updated
 */
export async function updateActivity(
  activityId: string,
  updates: {
    status?: ActivityStatus;
    text?: string;
    favicon?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const client = context.get("client");

  await client.updateTableRows({
    table: "ResearchActivityTable",
    rows: [
      {
        id: Number(activityId),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.text !== undefined && { text: updates.text }),
        ...(updates.favicon !== undefined && { favicon: updates.favicon }),
        ...(updates.metadata !== undefined && {
          metadata: JSON.stringify(updates.metadata),
        }),
      },
    ],
  });
}

/**
 * Lists all activities for a given messageId, ordered by sortOrder
 */
export async function listActivities(
  messageId: string
): Promise<ResearchActivity[]> {
  const client = context.get("client");

  const { rows } = await client.findTableRows({
    table: "ResearchActivityTable",
    filter: {
      messageId: { $eq: messageId },
    },
    orderBy: "createdAt",
    orderDirection: "asc",
    limit: 100,
  });

  return rows.map((row) => ({
    id: row.id.toString(),
    messageId: row.messageId.toString(),
    type: row.type as ActivityType,
    status: row.status as ActivityStatus,
    text: row.text.toString(),
    favicon: row.favicon?.toString(),
    metadata: row.metadata?.toString(),
  }));
}

/**
 * Deletes all activities for a given messageId
 * Useful for cleanup on workflow restart/cancel
 */
export async function deleteActivities(messageId: string): Promise<void> {
  const client = context.get("client");

  // First find all activities for this message
  const { rows } = await client.findTableRows({
    table: "ResearchActivityTable",
    filter: {
      messageId: { $eq: messageId },
    },
    limit: 1000,
  });

  if (rows.length === 0) {
    return;
  }

  // Delete them by ID
  await client.deleteTableRows({
    table: "ResearchActivityTable",
    ids: rows.map((row) => Number(row.id)),
  });
}
