import { context } from "@botpress/runtime";
import type {
  ActivityType,
  ActivityStatus,
  ExtractionActivity,
} from "../tables/extraction-activity";

/**
 * Helper functions for managing extraction activities in the table
 * Provides clean API for creating, updating, and listing activities
 */

/**
 * Creates a new extraction activity and returns its ID for future updates.
 * Uses uniqueKey for idempotency - if an activity with the same messageId+uniqueKey exists,
 * returns the existing one instead of creating a duplicate.
 */
export async function addActivity(
  messageId: string,
  userId: string,
  type: ActivityType,
  text: string,
  opts?: {
    contractId?: number;
    clauseType?: string;
    metadata?: Record<string, unknown>;
    uniqueKey?: string; // For idempotency - e.g., "reading" or "batch-5"
  }
): Promise<string> {
  const client = context.get("client");

  // If uniqueKey provided, check for existing activity to avoid duplicates on retries
  if (opts?.uniqueKey) {
    const { rows: existing } = await client.findTableRows({
      table: "extractionActivityTable",
      filter: {
        messageId: { $eq: messageId },
        type: { $eq: type },
        // Use metadata to store uniqueKey for deduplication
      },
      limit: 100,
    });

    // Look for matching uniqueKey in existing activities
    const match = existing.find((row) => {
      try {
        const meta = row.metadata ? JSON.parse(row.metadata.toString()) : {};
        return meta.uniqueKey === opts.uniqueKey;
      } catch {
        return false;
      }
    });

    if (match) {
      return match.id.toString();
    }
  }

  const metadata = {
    ...(opts?.metadata || {}),
    ...(opts?.uniqueKey && { uniqueKey: opts.uniqueKey }),
  };

  const { rows } = await client.createTableRows({
    table: "extractionActivityTable",
    rows: [
      {
        userId,
        messageId,
        contractId: opts?.contractId,
        type,
        status: "in_progress",
        text,
        clauseType: opts?.clauseType,
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
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
    clauseType?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const client = context.get("client");

  await client.updateTableRows({
    table: "extractionActivityTable",
    rows: [
      {
        id: Number(activityId),
        ...(updates.status !== undefined && { status: updates.status }),
        ...(updates.text !== undefined && { text: updates.text }),
        ...(updates.clauseType !== undefined && {
          clauseType: updates.clauseType,
        }),
        ...(updates.metadata !== undefined && {
          metadata: JSON.stringify(updates.metadata),
        }),
      },
    ],
  });
}

/**
 * Lists all activities for a given messageId, ordered by creation time
 * Filters by userId for security
 */
export async function listActivities(
  messageId: string,
  userId: string
): Promise<ExtractionActivity[]> {
  const client = context.get("client");

  const { rows } = await client.findTableRows({
    table: "extractionActivityTable",
    filter: {
      userId: { $eq: userId }, // Security: scope to current user
      messageId: { $eq: messageId },
    },
    orderBy: "createdAt",
    orderDirection: "asc",
    limit: 100,
  });

  return rows.map((row) => ({
    id: row.id.toString(),
    userId: row.userId.toString(),
    messageId: row.messageId.toString(),
    contractId: row.contractId ? Number(row.contractId) : undefined,
    type: row.type as ActivityType,
    status: row.status as ActivityStatus,
    text: row.text.toString(),
    clauseType: row.clauseType?.toString(),
    metadata: row.metadata?.toString(),
  }));
}

/**
 * Deletes all activities for a given messageId
 * Useful for cleanup on workflow restart/cancel
 */
export async function deleteActivities(messageId: string): Promise<void> {
  const client = context.get("client");

  const { rows } = await client.findTableRows({
    table: "extractionActivityTable",
    filter: {
      messageId: { $eq: messageId },
    },
    limit: 1000,
  });

  if (rows.length === 0) {
    return;
  }

  await client.deleteTableRows({
    table: "extractionActivityTable",
    ids: rows.map((row) => Number(row.id)),
  });
}
