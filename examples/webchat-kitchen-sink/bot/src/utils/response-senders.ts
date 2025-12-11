// ============================================
// Response Senders for Request/Response Pattern
// ============================================
// These functions send typed responses back to the frontend

import { bot, type Client, type Conversation } from "@botpress/runtime";
import type {
  CounterGetResponse,
  CounterIncrementResponse,
  CounterDecrementResponse,
  CounterResetResponse,
  NoteCreateResponse,
  NotesListResponse,
  NoteDeleteResponse,
} from "./shared-types";

/**
 * Generic response sender.
 * Sends a custom message that the frontend hook listens for.
 */
async function sendResponse<T extends { requestId: string }>(
  conversation: Conversation,
  client: Client,
  responseType: string,
  data: T
) {
  const conversationId = conversation.id;
  const botUserId = bot.id;

  await client.createMessage({
    conversationId,
    userId: botUserId,
    type: "custom",
    payload: {
      url: `custom://response/${responseType}`,
      data,
    },
  });
}

// Counter response senders
export const sendCounterGetResponse = (conversation: Conversation, client: Client, data: CounterGetResponse) =>
  sendResponse(conversation, client, "counter:get:response", data);

export const sendCounterIncrementResponse = (conversation: Conversation, client: Client, data: CounterIncrementResponse) =>
  sendResponse(conversation, client, "counter:increment:response", data);

export const sendCounterDecrementResponse = (conversation: Conversation, client: Client, data: CounterDecrementResponse) =>
  sendResponse(conversation, client, "counter:decrement:response", data);

export const sendCounterResetResponse = (conversation: Conversation, client: Client, data: CounterResetResponse) =>
  sendResponse(conversation, client, "counter:reset:response", data);

// Notes response senders
export const sendNoteCreateResponse = (conversation: Conversation, client: Client, data: NoteCreateResponse) =>
  sendResponse(conversation, client, "notes:create:response", data);

export const sendNotesListResponse = (conversation: Conversation, client: Client, data: NotesListResponse) =>
  sendResponse(conversation, client, "notes:list:response", data);

export const sendNoteDeleteResponse = (conversation: Conversation, client: Client, data: NoteDeleteResponse) =>
  sendResponse(conversation, client, "notes:delete:response", data);
