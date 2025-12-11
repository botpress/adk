// ============================================
// Push Activity Utility
// ============================================
// Handles pushing activities to the table and updating the live activity log.

import { context } from "@botpress/runtime";
import { ActivitiesTable } from "../tables/activities";
import type { EventLogEntry, LiveActivityLog } from "./shared-types";

export type ActivityEvent = {
  type: string;
  payload: unknown;
};

const MAX_LOG_ENTRIES = 8;

/** Custom message URL for activity logs */
export const ACTIVITY_LOGS_URL = "custom://activity-logs";

/**
 * Push an activity to the activities table and update the live activity log.
 *
 * This function:
 * 1. Stores the activity in the ActivitiesTable
 * 2. Fetches last X activities from the table (sorted by createdAt desc)
 * 3. Updates the live activity log message with the latest entries
 *
 * @param conversationId - The conversation ID
 * @param event - The activity event to push
 * @param logsMessageId - The message ID for the live activity log (required)
 */
export async function pushActivity(
  conversationId: string,
  event: ActivityEvent,
  logsMessageId: string
): Promise<void> {
  const client = context.get("client");
  const eventId =
    context.get("event", { optional: true })?.id ||
    context.get("message", { optional: true })?.id ||
    `N/A`;

  // 1. Store the activity in the table
  await ActivitiesTable.createRows({
    rows: [
      {
        conversationId,
        eventId,
        event: {
          type: event.type,
          payload: event.payload as {},
        },
      },
    ],
  });

  // 2. Fetch last X activities for this conversation (sorted desc)
  const { rows: activityRows } = await ActivitiesTable.findRows({
    filter: { conversationId },
    orderBy: "createdAt",
    orderDirection: "desc",
    limit: MAX_LOG_ENTRIES,
  });

  // 3. Convert to EventLogEntry format (reverse to show oldest first in UI)
  const entries: EventLogEntry[] = activityRows.reverse().map((row) => ({
    id: row.eventId,
    eventType: row.event.type,
    data: (row.event.payload as Record<string, unknown>) ?? {},
    timestamp: row.createdAt,
  }));

  // 4. Update the live activity log message
  const logData: LiveActivityLog = {
    entries,
    lastUpdated: new Date().toISOString(),
    maxEntries: MAX_LOG_ENTRIES,
  };

  await client.updateMessage({
    id: logsMessageId,
    tags: {},
    payload: {
      name: "Activity Logs",
      url: ACTIVITY_LOGS_URL,
      data: logData,
    },
  });
}
