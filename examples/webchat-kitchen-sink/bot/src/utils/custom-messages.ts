// ============================================
// Custom Message Senders (Bot → Frontend)
// ============================================
// Pattern 3: Send rich UI components to the chat
// Pattern 4: Send bot-initiated requests

import { bot } from "@botpress/runtime";
import type {
  InfoCard,
  EventLogBlock,
  BotRequest,
  BotRequestStatus,
  LiveActivityLog,
  EventLogEntry,
} from "./shared-types";

// Simple type for conversation-like objects that have an id
type ConversationLike = { id: string };

// Use `any` for client args to be compatible with BotClient's complex types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientLike = {
  createMessage: (args: any) => Promise<{ message: { id: string } }>;
  updateMessage: (args: any) => Promise<unknown>;
  getMessage: (args: any) => Promise<{ message: { payload: unknown } }>;
};

/**
 * Send an info card to the chat (Pattern 3).
 */
export async function sendInfoCard(
  conversation: ConversationLike,
  client: ClientLike,
  card: Omit<InfoCard, "id" | "timestamp">
) {
  const conversationId = conversation.id;
  const botUserId = bot.id;

  const fullCard: InfoCard = {
    ...card,
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    timestamp: new Date().toISOString(),
  };

  const { message } = await client.createMessage({
    conversationId,
    userId: botUserId,
    type: "custom",
    payload: {
      url: "custom://info-card",
      data: fullCard,
    },
  });

  return message;
}

/**
 * Send an event log block to the chat (Pattern 3).
 * Shows the events that have been received.
 */
export async function sendEventLog(
  conversation: ConversationLike,
  client: ClientLike,
  log: EventLogBlock
) {
  const conversationId = conversation.id;
  const botUserId = bot.id;

  const { message } = await client.createMessage({
    conversationId,
    userId: botUserId,
    type: "custom",
    payload: {
      url: "custom://event-log",
      data: log,
    },
  });

  return message;
}

// ============================================
// Live Activity Log (Pattern 1 Enhancement)
// ============================================

const MAX_ACTIVITY_ENTRIES = 8;

/**
 * Create a new live activity log message.
 * Returns the message ID for future updates.
 */
export async function createLiveActivityLog(
  conversation: ConversationLike,
  client: ClientLike,
  entries: EventLogEntry[]
): Promise<string> {
  const conversationId = conversation.id;
  const botUserId = bot.id;

  const logData: LiveActivityLog = {
    entries: entries.slice(-MAX_ACTIVITY_ENTRIES),
    lastUpdated: new Date().toISOString(),
    maxEntries: MAX_ACTIVITY_ENTRIES,
  };

  const { message } = await client.createMessage({
    conversationId,
    userId: botUserId,
    type: "custom",
    payload: {
      url: "custom://live-activity-log",
      data: logData,
    },
  });

  return message.id;
}

/**
 * Update an existing live activity log message with new entries.
 */
export async function updateLiveActivityLog(
  client: ClientLike,
  messageId: string,
  entries: EventLogEntry[]
): Promise<void> {
  const logData: LiveActivityLog = {
    entries: entries.slice(-MAX_ACTIVITY_ENTRIES),
    lastUpdated: new Date().toISOString(),
    maxEntries: MAX_ACTIVITY_ENTRIES,
  };

  await client.updateMessage({
    id: messageId,
    payload: {
      url: "custom://live-activity-log",
      data: logData,
    },
  });
}

// ============================================
// Pattern 4: Bot Requests
// ============================================

const DEFAULT_EXPIRY: Record<string, number> = {
  "browser:get-url": 60,
  "clipboard:copy": 30,
  "browser:get-time": 30,
};

interface SendBotRequestOptions {
  expiresInSeconds?: number;
}

/**
 * Send a bot request to the frontend (Pattern 4).
 * Returns requestId and messageId for tracking.
 */
export async function sendBotRequest(
  conversation: ConversationLike,
  client: ClientLike,
  request: Omit<BotRequest, "requestId" | "expiresAt" | "expiresInSeconds" | "status">,
  options: SendBotRequestOptions = {}
): Promise<{ requestId: string; messageId: string }> {
  const conversationId = conversation.id;
  const botUserId = bot.id;

  const requestId = `bot-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_EXPIRY[request.action] ?? 60;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const fullRequest: BotRequest = {
    ...request,
    requestId,
    expiresAt,
    expiresInSeconds,
    status: "pending",
  } as BotRequest;

  const { message } = await client.createMessage({
    conversationId,
    userId: botUserId,
    type: "custom",
    payload: {
      url: "custom://bot-request",
      data: fullRequest,
    },
  });

  return { requestId, messageId: message.id };
}

/**
 * Update the status of a bot request message.
 */
export async function updateBotRequestStatus(
  client: ClientLike,
  messageId: string,
  status: BotRequestStatus,
  updates: {
    statusMessage?: string;
    respondedAt?: string;
    result?: unknown;
  } = {}
) {
  const { message } = await client.getMessage({ id: messageId });
  const existingData = (message.payload as { data: BotRequest }).data;

  const updatedData: BotRequest = {
    ...existingData,
    status,
    ...updates,
  };

  await client.updateMessage({
    id: messageId,
    payload: {
      url: "custom://bot-request",
      data: updatedData,
    },
  });
}

// Convenience functions for common bot requests
export async function requestBrowserUrl(
  conversation: ConversationLike,
  client: ClientLike
) {
  return sendBotRequest(conversation, client, {
    action: "browser:get-url",
    title: "Get Current URL",
    description: "The bot wants to know what page you're viewing",
    icon: "🔗",
    requiresConfirmation: true,
  });
}

export async function requestCopyToClipboard(
  conversation: ConversationLike,
  client: ClientLike,
  text: string
) {
  return sendBotRequest(conversation, client, {
    action: "clipboard:copy",
    title: "Copy to Clipboard",
    description: `The bot wants to copy: "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`,
    icon: "📋",
    requiresConfirmation: false,
    params: { text },
  } as Omit<BotRequest, "requestId" | "expiresAt" | "expiresInSeconds" | "status">);
}

export async function requestCurrentTime(
  conversation: ConversationLike,
  client: ClientLike
) {
  return sendBotRequest(conversation, client, {
    action: "browser:get-time",
    title: "Get Current Time",
    description: "The bot wants to know your local time",
    icon: "🕐",
    requiresConfirmation: false,
  });
}
