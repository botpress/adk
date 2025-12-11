// ============================================
// Shared Types for Frontend-Bot Communication
// ============================================
// This file defines all the types used for bidirectional
// communication between the React frontend and Botpress ADK bot.

// ============================================
// Pattern 1: Fire-and-Forget Events (Frontend → Bot)
// ============================================
// Events where frontend doesn't expect a response

export type FireAndForgetEvent =
  | { type: "analytics:track"; data: { event: string; properties?: Record<string, unknown> } }
  | { type: "ui:button-clicked"; data: { buttonId: string; timestamp: string } }
  | { type: "ui:theme-changed"; data: { theme: "light" | "dark" } };

// ============================================
// Pattern 2: Request/Response (Frontend ↔ Bot)
// ============================================
// Promise-like pattern with correlated request/response

// Base types
export interface BaseRequest {
  requestId: string;
}

export interface BaseResponse {
  requestId: string;
  success: boolean;
  error?: string;
}

// Counter Actions - Simple demo of request/response
export interface CounterGetRequest extends BaseRequest {}

export interface CounterGetResponse extends BaseResponse {
  value?: number;
}

export interface CounterIncrementRequest extends BaseRequest {
  amount?: number;
}

export interface CounterIncrementResponse extends BaseResponse {
  newValue?: number;
}

export interface CounterDecrementRequest extends BaseRequest {
  amount?: number;
}

export interface CounterDecrementResponse extends BaseResponse {
  newValue?: number;
}

export interface CounterResetRequest extends BaseRequest {}

export interface CounterResetResponse extends BaseResponse {
  value?: number;
}

// Note Actions - Simple CRUD demo
export interface NoteCreateRequest extends BaseRequest {
  text: string;
}

export interface NoteCreateResponse extends BaseResponse {
  noteId?: string;
  text?: string;
  createdAt?: string;
}

export interface NotesListRequest extends BaseRequest {}

export interface NotesListResponse extends BaseResponse {
  notes?: Array<{ id: string; text: string; createdAt: string }>;
}

export interface NoteDeleteRequest extends BaseRequest {
  noteId: string;
}

export interface NoteDeleteResponse extends BaseResponse {
  deletedId?: string;
}

// Union Types for Type Guards
export type RequestEvent =
  | { type: "counter:get:request"; data: CounterGetRequest }
  | { type: "counter:increment:request"; data: CounterIncrementRequest }
  | { type: "counter:decrement:request"; data: CounterDecrementRequest }
  | { type: "counter:reset:request"; data: CounterResetRequest }
  | { type: "notes:create:request"; data: NoteCreateRequest }
  | { type: "notes:list:request"; data: NotesListRequest }
  | { type: "notes:delete:request"; data: NoteDeleteRequest };

export type ResponseData =
  | { type: "counter:get:response"; data: CounterGetResponse }
  | { type: "counter:increment:response"; data: CounterIncrementResponse }
  | { type: "counter:decrement:response"; data: CounterDecrementResponse }
  | { type: "counter:reset:response"; data: CounterResetResponse }
  | { type: "notes:create:response"; data: NoteCreateResponse }
  | { type: "notes:list:response"; data: NotesListResponse }
  | { type: "notes:delete:response"; data: NoteDeleteResponse };

// Helper to get response type from request type
export type ResponseTypeMap = {
  "counter:get:request": CounterGetResponse;
  "counter:increment:request": CounterIncrementResponse;
  "counter:decrement:request": CounterDecrementResponse;
  "counter:reset:request": CounterResetResponse;
  "notes:create:request": NoteCreateResponse;
  "notes:list:request": NotesListResponse;
  "notes:delete:request": NoteDeleteResponse;
};

// ============================================
// Pattern 3: Custom Message Blocks (Bot → Frontend)
// ============================================
// Rich UI components rendered in chat

// Info card that bot can send
export interface InfoCard {
  id: string;
  title: string;
  description: string;
  variant: "info" | "success" | "warning" | "error";
  timestamp: string;
}

// Event log entry for the demo
export interface EventLogEntry {
  id: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// Event log component - shows received fire-and-forget events
export interface EventLogBlock {
  entries: EventLogEntry[];
}

// Live Activity Log - auto-updating message for Pattern 1
export interface LiveActivityLog {
  entries: EventLogEntry[];
  lastUpdated: string;
  maxEntries: number;
}

// ============================================
// Pattern 4: Bot Requests (Bot → Frontend → Bot)
// ============================================
// Bot-initiated requests with confirmation UI

export type BotRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "cancelled"
  | "error";

export interface BotRequestBase {
  requestId: string;
  action: string;
  title: string;
  description?: string;
  icon?: string;
  requiresConfirmation: boolean;
  expiresAt: string;
  expiresInSeconds: number;
  status: BotRequestStatus;
  statusMessage?: string;
  respondedAt?: string;
  result?: unknown;
}

export interface BotResponseBase {
  requestId: string;
  approved: boolean;
  error?: string;
}

// Browser URL Request
export interface GetBrowserUrlRequest extends BotRequestBase {
  action: "browser:get-url";
}

export interface GetBrowserUrlResponse extends BotResponseBase {
  url?: string;
  title?: string;
}

// Copy to Clipboard Request
export interface CopyToClipboardRequest extends BotRequestBase {
  action: "clipboard:copy";
  params: {
    text: string;
  };
}

export interface CopyToClipboardResponse extends BotResponseBase {
  copied?: boolean;
}

// Get Current Time Request (simple demo)
export interface GetTimeRequest extends BotRequestBase {
  action: "browser:get-time";
}

export interface GetTimeResponse extends BotResponseBase {
  time?: string;
  timezone?: string;
}

// Union Types
export type BotRequest =
  | GetBrowserUrlRequest
  | CopyToClipboardRequest
  | GetTimeRequest;

export type BotResponse =
  | GetBrowserUrlResponse
  | CopyToClipboardResponse
  | GetTimeResponse;

export type BotRequestResponseMap = {
  "browser:get-url": GetBrowserUrlResponse;
  "clipboard:copy": CopyToClipboardResponse;
  "browser:get-time": GetTimeResponse;
};

// Default permissions
export const DEFAULT_PERMISSIONS: Record<string, "always" | "ask" | "never"> = {
  "browser:get-url": "ask",
  "clipboard:copy": "always",
  "browser:get-time": "always",
};

// ============================================
// State Types
// ============================================

export interface Note {
  id: string;
  text: string;
  createdAt: string;
}

export interface ConversationState {
  counter: number;
  notes: Note[];
  eventLog: EventLogEntry[];
  pendingBotRequests: Record<string, string>; // requestId -> messageId
}
