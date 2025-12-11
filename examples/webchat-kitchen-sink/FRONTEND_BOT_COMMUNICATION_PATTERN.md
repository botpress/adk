# Frontend-Bot Communication Pattern for Botpress ADK

This document describes type-safe patterns for bidirectional communication between a React frontend and a Botpress ADK bot.

## Overview

There are four communication patterns:

1. **Fire-and-Forget Events** (Frontend → Bot): One-way events that don't expect a response
2. **Request/Response Pattern** (Frontend ↔ Bot): Promise-like pattern with correlated request/response
3. **Custom Message Blocks** (Bot → Frontend): Rich UI components rendered in chat
4. **Bot Requests** (Bot → Frontend → Bot): Bot-initiated tool calls with confirmation UI and expiry

---

## Pattern 1: Fire-and-Forget Events

Use for actions where the frontend doesn't need a direct response (e.g., analytics, notifications).

### Shared Types

```typescript
// bot/src/utils/shared-types.ts

export type FireAndForgetEvent =
  | { type: "analytics:track"; data: { event: string; properties?: Record<string, unknown> } }
  | { type: "ui:notification-dismissed"; data: { notificationId: string } }
  | { type: "post:copied"; data: { postId: string; content: string } };
```

### Frontend: Send Event

```typescript
const sendEvent = (type: string, data: Record<string, unknown>) => {
  client.sendEvent({ eventType: type, data });
};

// Usage
sendEvent("analytics:track", { event: "button_clicked", properties: { buttonId: "cta" } });
```

### Bot: Handle Event

```typescript
const customEvent = extractCustomEvent(event);
if (customEvent?.type === "analytics:track") {
  // Handle, no response needed
  return;
}
```

---

## Pattern 2: Request/Response (Promise-Like)

Use when the frontend needs a response from the bot (e.g., auth, data fetching, mutations).

### How It Works

1. Frontend generates a unique `requestId`
2. Frontend sends `action:request` event with `requestId` + payload
3. Frontend creates a Promise that listens for `action:response` with matching `requestId`
4. Bot processes request, sends response message with `requestId`
5. Frontend resolves Promise with response data

### Shared Types

```typescript
// bot/src/utils/shared-types.ts

// ============================================
// Request/Response Type Definitions
// ============================================

// Base request shape
export interface BaseRequest {
  requestId: string;
}

// Base response shape
export interface BaseResponse {
  requestId: string;
  success: boolean;
  error?: string;
}

// ============================================
// Auth Actions
// ============================================

export interface AuthLoginRequest extends BaseRequest {
  username: string;
  password: string;
}

export interface AuthLoginResponse extends BaseResponse {
  username?: string;
  token?: string;
}

export interface AuthSignupRequest extends BaseRequest {
  username: string;
  password: string;
  email?: string;
}

export interface AuthSignupResponse extends BaseResponse {
  username?: string;
}

export interface AuthLogoutRequest extends BaseRequest {}

export interface AuthLogoutResponse extends BaseResponse {}

// ============================================
// Tool Actions
// ============================================

export interface ToolApproveRequest extends BaseRequest {
  suggestionId: string;
}

export interface ToolApproveResponse extends BaseResponse {
  toolName?: string;
  result?: unknown;
}

export interface ToolDeclineRequest extends BaseRequest {
  suggestionId: string;
}

export interface ToolDeclineResponse extends BaseResponse {}

// ============================================
// Profile Actions
// ============================================

export interface ProfileUpdateRequest extends BaseRequest {
  fields: Record<string, string>;
}

export interface ProfileUpdateResponse extends BaseResponse {
  updatedFields?: string[];
}

export interface ProfileGetRequest extends BaseRequest {}

export interface ProfileGetResponse extends BaseResponse {
  profile?: UserProfile;
}

// ============================================
// Union Types for Type Guards
// ============================================

export type RequestEvent =
  | { type: "auth:login:request"; data: AuthLoginRequest }
  | { type: "auth:signup:request"; data: AuthSignupRequest }
  | { type: "auth:logout:request"; data: AuthLogoutRequest }
  | { type: "tool:approve:request"; data: ToolApproveRequest }
  | { type: "tool:decline:request"; data: ToolDeclineRequest }
  | { type: "profile:update:request"; data: ProfileUpdateRequest }
  | { type: "profile:get:request"; data: ProfileGetRequest };

export type ResponseData =
  | { type: "auth:login:response"; data: AuthLoginResponse }
  | { type: "auth:signup:response"; data: AuthSignupResponse }
  | { type: "auth:logout:response"; data: AuthLogoutResponse }
  | { type: "tool:approve:response"; data: ToolApproveResponse }
  | { type: "tool:decline:response"; data: ToolDeclineResponse }
  | { type: "profile:update:response"; data: ProfileUpdateResponse }
  | { type: "profile:get:response"; data: ProfileGetResponse };

// Helper to get response type from request type
export type ResponseTypeMap = {
  "auth:login:request": AuthLoginResponse;
  "auth:signup:request": AuthSignupResponse;
  "auth:logout:request": AuthLogoutResponse;
  "tool:approve:request": ToolApproveResponse;
  "tool:decline:request": ToolDeclineResponse;
  "profile:update:request": ProfileUpdateResponse;
  "profile:get:request": ProfileGetResponse;
};
```

### Frontend: Request/Response Hook

```typescript
// frontend/src/hooks/useBotRequest.ts

import { useWebchat } from "@botpress/webchat";
import { useCallback, useEffect, useRef } from "react";
import type { ResponseTypeMap } from "../types/shared";

type RequestType = keyof ResponseTypeMap;

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export function useBotRequest() {
  const { client } = useWebchat();
  const pendingRequests = useRef<Map<string, PendingRequest<any>>>(new Map());

  // Generate unique request ID
  const generateRequestId = () =>
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Listen for response messages
  useEffect(() => {
    if (!client) return;

    const handleMessage = (message: any) => {
      // Check if this is a response message
      if (message.payload?.type !== "custom") return;

      const url = message.payload?.url as string;
      if (!url?.startsWith("custom://response/")) return;

      const data = message.payload?.data;
      const requestId = data?.requestId;

      if (!requestId) return;

      const pending = pendingRequests.current.get(requestId);
      if (!pending) return;

      // Clear timeout and remove from pending
      clearTimeout(pending.timeout);
      pendingRequests.current.delete(requestId);

      // Resolve or reject based on success
      if (data.success) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(data.error || "Request failed"));
      }
    };

    client.on("message", handleMessage);
    return () => client.off("message", handleMessage);
  }, [client]);

  // Send request and wait for response
  const request = useCallback(
    <T extends RequestType>(
      type: T,
      payload: Omit<Parameters<typeof client.sendEvent>[0]["data"], "requestId">,
      timeoutMs = 30000
    ): Promise<ResponseTypeMap[T]> => {
      return new Promise((resolve, reject) => {
        if (!client) {
          reject(new Error("Client not connected"));
          return;
        }

        const requestId = generateRequestId();

        // Set timeout
        const timeout = setTimeout(() => {
          pendingRequests.current.delete(requestId);
          reject(new Error(`Request ${type} timed out`));
        }, timeoutMs);

        // Store pending request
        pendingRequests.current.set(requestId, { resolve, reject, timeout });

        // Send the request
        client.sendEvent({
          eventType: type,
          data: { ...payload, requestId },
        }).catch((err) => {
          clearTimeout(timeout);
          pendingRequests.current.delete(requestId);
          reject(err);
        });
      });
    },
    [client]
  );

  return { request };
}
```

### Frontend: Usage Examples

```typescript
// frontend/src/components/LoginForm.tsx

import { useBotRequest } from "../hooks/useBotRequest";

function LoginForm() {
  const { request } = useBotRequest();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await request("auth:login:request", { username, password });
      // response is typed as AuthLoginResponse
      console.log("Logged in as:", response.username);
      setUser({ username: response.username! });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // ...
}
```

```typescript
// frontend/src/components/ProfileEditor.tsx

function ProfileEditor() {
  const { request } = useBotRequest();

  const handleSave = async (fields: Record<string, string>) => {
    try {
      const response = await request("profile:update:request", { fields });
      // response is typed as ProfileUpdateResponse
      toast.success(`Updated: ${response.updatedFields?.join(", ")}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ...
}
```

### Bot: Event Extraction

```typescript
// bot/src/utils/event-guards.ts

import type { RequestEvent } from "./shared-types";

/**
 * Extract request event from webchat trigger.
 *
 * Webchat trigger structure:
 * {
 *   type: "webchat:trigger",
 *   payload: {
 *     payload: {
 *       eventType: {
 *         type: "custom",
 *         payload: {
 *           eventType: "auth:login:request",
 *           data: { requestId: "...", username: "...", password: "..." }
 *         }
 *       }
 *     }
 *   }
 * }
 */
export function extractRequestEvent(event: unknown): RequestEvent | null {
  if (!event || typeof event !== "object") return null;

  const e = event as Record<string, unknown>;
  if (e.type !== "webchat:trigger") return null;

  const payload = e.payload as any;
  if (!payload?.payload?.eventType) return null;

  const eventType = payload.payload.eventType;
  if (eventType.type !== "custom") return null;

  const innerPayload = eventType.payload;
  if (!innerPayload?.eventType || !innerPayload?.data) return null;

  const type = innerPayload.eventType as string;
  const data = innerPayload.data;

  // Validate it's a request type
  if (!type.endsWith(":request")) return null;

  // Validate requestId exists
  if (typeof data.requestId !== "string") return null;

  // Return typed event based on type
  switch (type) {
    case "auth:login:request":
      if (isValidAuthLoginRequest(data)) {
        return { type, data };
      }
      break;
    case "auth:signup:request":
      if (isValidAuthSignupRequest(data)) {
        return { type, data };
      }
      break;
    case "auth:logout:request":
      return { type, data: { requestId: data.requestId } };
    case "tool:approve:request":
      if (isValidToolApproveRequest(data)) {
        return { type, data };
      }
      break;
    case "tool:decline:request":
      if (isValidToolDeclineRequest(data)) {
        return { type, data };
      }
      break;
    case "profile:update:request":
      if (isValidProfileUpdateRequest(data)) {
        return { type, data };
      }
      break;
    case "profile:get:request":
      return { type, data: { requestId: data.requestId } };
  }

  return null;
}

// Validators
function isValidAuthLoginRequest(data: any): boolean {
  return typeof data.username === "string" && typeof data.password === "string";
}

function isValidAuthSignupRequest(data: any): boolean {
  return typeof data.username === "string" && typeof data.password === "string";
}

function isValidToolApproveRequest(data: any): boolean {
  return typeof data.suggestionId === "string";
}

function isValidToolDeclineRequest(data: any): boolean {
  return typeof data.suggestionId === "string";
}

function isValidProfileUpdateRequest(data: any): boolean {
  return typeof data.fields === "object" && data.fields !== null;
}
```

### Bot: Response Senders

```typescript
// bot/src/utils/response-senders.ts

import { context } from "@botpress/runtime";
import type {
  AuthLoginResponse,
  AuthSignupResponse,
  AuthLogoutResponse,
  ToolApproveResponse,
  ToolDeclineResponse,
  ProfileUpdateResponse,
  ProfileGetResponse,
} from "./shared-types";

/**
 * Generic response sender.
 * Sends a custom message that the frontend listens for.
 */
async function sendResponse<T extends { requestId: string }>(
  responseType: string,
  data: T
) {
  const client = context.get("client");
  const conversationId = context.get("conversationId");

  await client.createMessage({
    conversationId,
    userId: context.get("botUserId"),
    type: "custom",
    payload: {
      url: `custom://response/${responseType}`,
      data,
    },
  });
}

// Typed response senders
export const sendAuthLoginResponse = (data: AuthLoginResponse) =>
  sendResponse("auth:login:response", data);

export const sendAuthSignupResponse = (data: AuthSignupResponse) =>
  sendResponse("auth:signup:response", data);

export const sendAuthLogoutResponse = (data: AuthLogoutResponse) =>
  sendResponse("auth:logout:response", data);

export const sendToolApproveResponse = (data: ToolApproveResponse) =>
  sendResponse("tool:approve:response", data);

export const sendToolDeclineResponse = (data: ToolDeclineResponse) =>
  sendResponse("tool:decline:response", data);

export const sendProfileUpdateResponse = (data: ProfileUpdateResponse) =>
  sendResponse("profile:update:response", data);

export const sendProfileGetResponse = (data: ProfileGetResponse) =>
  sendResponse("profile:get:response", data);
```

### Bot: Conversation Handler

```typescript
// bot/src/conversations/index.ts

import { Conversation, z, user, context } from "@botpress/runtime";
import { extractRequestEvent } from "../utils/event-guards";
import {
  sendAuthLoginResponse,
  sendAuthSignupResponse,
  sendAuthLogoutResponse,
  sendToolApproveResponse,
  sendProfileUpdateResponse,
} from "../utils/response-senders";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  events: ["webchat:trigger"],
  state: z.object({
    // your state
  }),
  handler: async ({ execute, state, event }) => {
    const client = context.get("client");

    // Handle request/response events
    const requestEvent = extractRequestEvent(event);
    if (requestEvent) {
      const { requestId } = requestEvent.data;

      switch (requestEvent.type) {
        case "auth:login:request": {
          const { username, password } = requestEvent.data;

          try {
            // Your auth logic here
            const userRecord = await authenticateUser(username, password);

            if (userRecord) {
              user.state.isLoggedIn = true;
              user.state.username = userRecord.username;

              await sendAuthLoginResponse({
                requestId,
                success: true,
                username: userRecord.username,
              });
            } else {
              await sendAuthLoginResponse({
                requestId,
                success: false,
                error: "Invalid credentials",
              });
            }
          } catch (err) {
            await sendAuthLoginResponse({
              requestId,
              success: false,
              error: "Authentication failed",
            });
          }
          return;
        }

        case "auth:signup:request": {
          const { username, password } = requestEvent.data;

          try {
            const newUser = await createUser(username, password);

            user.state.isLoggedIn = true;
            user.state.username = newUser.username;

            await sendAuthSignupResponse({
              requestId,
              success: true,
              username: newUser.username,
            });
          } catch (err) {
            await sendAuthSignupResponse({
              requestId,
              success: false,
              error: err.message || "Signup failed",
            });
          }
          return;
        }

        case "auth:logout:request": {
          user.state.isLoggedIn = false;
          user.state.username = undefined;

          await sendAuthLogoutResponse({
            requestId,
            success: true,
          });
          return;
        }

        case "tool:approve:request": {
          const { suggestionId } = requestEvent.data;

          // Find and execute the pending tool
          if (state.pendingSuggestion?.id === suggestionId) {
            const result = await executeTool(state.pendingSuggestion);
            state.pendingSuggestion = undefined;

            await sendToolApproveResponse({
              requestId,
              success: true,
              toolName: result.toolName,
              result: result.data,
            });
          } else {
            await sendToolApproveResponse({
              requestId,
              success: false,
              error: "Suggestion not found or expired",
            });
          }
          return;
        }

        case "profile:update:request": {
          const { fields } = requestEvent.data;

          try {
            await client.updateTableRows({
              table: "UsersTable",
              rows: [{ id: user.state.odataId, ...fields }],
            });

            await sendProfileUpdateResponse({
              requestId,
              success: true,
              updatedFields: Object.keys(fields),
            });
          } catch (err) {
            await sendProfileUpdateResponse({
              requestId,
              success: false,
              error: "Failed to update profile",
            });
          }
          return;
        }

        // ... handle other request types
      }
    }

    // Not a request event - run autonomous agent for regular messages
    await execute({
      model: "gpt-4",
      instructions: `...`,
      tools: () => [...],
    });
  },
});
```

---

## Pattern 3: Custom Message Blocks (Bot → Frontend)

Use for rich UI components in the chat (cards, post previews, interactive elements).

### Shared Types

```typescript
// bot/src/utils/shared-types.ts

// Tool suggestion card
export interface ToolSuggestion {
  suggestionId: string;
  toolName: string;
  status: "pending" | "approved" | "declined";
  timestamp: string;
  data: Record<string, unknown>;
}

// Generated content preview
export interface GeneratedContent {
  id: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}
```

### Bot: Send Custom Block

```typescript
// bot/src/utils/custom-messages.ts

import { context } from "@botpress/runtime";
import type { ToolSuggestion, GeneratedContent } from "./shared-types";

export async function sendToolSuggestion(suggestion: ToolSuggestion) {
  const client = context.get("client");
  const conversationId = context.get("conversationId");

  const { message } = await client.createMessage({
    conversationId,
    userId: context.get("botUserId"),
    type: "custom",
    payload: {
      url: "custom://tool-suggestion",
      data: suggestion,
    },
  });

  return message;
}

export async function sendGeneratedContent(content: GeneratedContent) {
  const client = context.get("client");
  const conversationId = context.get("conversationId");

  await client.createMessage({
    conversationId,
    userId: context.get("botUserId"),
    type: "custom",
    payload: {
      url: "custom://generated-content",
      data: content,
    },
  });
}

// Update existing message (e.g., change suggestion status)
export async function updateToolSuggestion(
  messageId: string,
  updates: Partial<ToolSuggestion>
) {
  const client = context.get("client");
  const { message } = await client.getMessage({ id: messageId });
  const existing = (message.payload as any).data as ToolSuggestion;

  await client.updateMessage({
    id: messageId,
    payload: {
      url: "custom://tool-suggestion",
      data: { ...existing, ...updates },
    },
  });
}
```

### Frontend: Custom Block Renderer

```typescript
// frontend/src/components/CustomBlockRenderer.tsx

import { type FC, useEffect, useRef } from "react";
import type { BlockObjects } from "@botpress/webchat";
import type { ToolSuggestion, GeneratedContent } from "../types/shared";

interface Props extends BlockObjects["custom"] {
  onToolAction?: (suggestionId: string, action: "approve" | "decline") => void;
}

const CustomBlockRenderer: FC<Props> = (props) => {
  const url = props.url || "";
  const data = (props as { data?: unknown }).data;

  // Tool suggestion card
  if (url === "custom://tool-suggestion" && data) {
    const suggestion = data as ToolSuggestion;
    return (
      <ToolSuggestionCard
        suggestion={suggestion}
        onApprove={() => props.onToolAction?.(suggestion.suggestionId, "approve")}
        onDecline={() => props.onToolAction?.(suggestion.suggestionId, "decline")}
      />
    );
  }

  // Generated content preview
  if (url === "custom://generated-content" && data) {
    const content = data as GeneratedContent;
    return <ContentPreview content={content} />;
  }

  // Response messages (from request/response pattern) - don't render visually
  if (url.startsWith("custom://response/")) {
    return null; // Handled by useBotRequest hook
  }

  return null;
};

export default CustomBlockRenderer;
```

### Frontend: Wire Up in Webchat

```typescript
// frontend/src/App.tsx

import { Webchat, useWebchat } from "@botpress/webchat";
import { useBotRequest } from "./hooks/useBotRequest";
import CustomBlockRenderer from "./components/CustomBlockRenderer";

function ChatContent() {
  const { request } = useBotRequest();

  const handleToolAction = useCallback(
    async (suggestionId: string, action: "approve" | "decline") => {
      try {
        if (action === "approve") {
          await request("tool:approve:request", { suggestionId });
        } else {
          await request("tool:decline:request", { suggestionId });
        }
      } catch (err) {
        console.error("Tool action failed:", err);
      }
    },
    [request]
  );

  const renderCustomBlock = useCallback(
    (block: BlockObjects["custom"]) => (
      <CustomBlockRenderer {...block} onToolAction={handleToolAction} />
    ),
    [handleToolAction]
  );

  return (
    <Webchat.Root>
      <Webchat.Messages>
        {(message) => (
          <Webchat.MessageGroup key={message.id} message={message}>
            <Webchat.MessageList message={message}>
              {(block) => (
                <Webchat.BlockRenderer
                  key={block.id}
                  block={block}
                  renderCustomBlock={renderCustomBlock}
                />
              )}
            </Webchat.MessageList>
          </Webchat.MessageGroup>
        )}
      </Webchat.Messages>
      <Webchat.Composer />
    </Webchat.Root>
  );
}
```

---

## Type Cohesion: Single Source of Truth

### Frontend Imports from Bot

```typescript
// frontend/src/types/shared.ts

export type {
  // Base types
  BaseRequest,
  BaseResponse,

  // Auth
  AuthLoginRequest,
  AuthLoginResponse,
  AuthSignupRequest,
  AuthSignupResponse,
  AuthLogoutRequest,
  AuthLogoutResponse,

  // Tools
  ToolApproveRequest,
  ToolApproveResponse,
  ToolDeclineRequest,
  ToolDeclineResponse,

  // Profile
  ProfileUpdateRequest,
  ProfileUpdateResponse,
  ProfileGetRequest,
  ProfileGetResponse,

  // Union types
  RequestEvent,
  ResponseData,
  ResponseTypeMap,

  // Custom blocks
  ToolSuggestion,
  GeneratedContent,
} from "../../../bot/src/utils/shared-types";
```

---

## Key Implementation Notes

### 1. Webchat Trigger Event Structure

The webchat trigger has deeply nested structure:
```
event.type === "webchat:trigger"
event.payload.payload.eventType.type === "custom"
event.payload.payload.eventType.payload.eventType === "auth:login:request"
event.payload.payload.eventType.payload.data === { requestId, username, password }
```

### 2. Return Early OR Continue to Autonomous Agent

After handling an event, you have two choices:

```typescript
if (requestEvent) {
  switch (requestEvent.type) {
    case "auth:login:request":
      // handle...
      await sendAuthLoginResponse({ requestId, success: true, username });

      // Option A: Return early - don't run autonomous agent
      return;

      // Option B: Don't return - let autonomous agent respond
      // This is useful when you want the bot to acknowledge the action
      // e.g., "Welcome back, John! What would you like to do today?"
      break;
  }
}

// Autonomous agent runs if we didn't return
await execute({ ... });
```

**When to return early:**
- Pure data operations (profile updates, analytics)
- When the response message IS the acknowledgment
- When you don't want AI-generated follow-up

**When to continue to autonomous agent:**
- After login/signup - bot can greet the user
- After tool approval - bot can explain what happened
- When the action should trigger a conversational response

### 3. Response Messages Should Be Hidden

Response messages exist only to deliver data to the frontend hook. Hide them:
```typescript
if (url.startsWith("custom://response/")) {
  return null;
}
```

### 4. Timeout Handling

Always implement timeouts in the frontend hook to prevent hanging promises:
```typescript
const timeout = setTimeout(() => {
  pendingRequests.current.delete(requestId);
  reject(new Error(`Request ${type} timed out`));
}, timeoutMs);
```

### 5. Request ID Generation

Use timestamp + random string for uniqueness:
```typescript
const generateRequestId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

---

## Pattern 4: Bot → Frontend Requests (Bot-Initiated Tool Calls)

Use when the bot needs data or actions from the frontend (e.g., get browser URL, navigate, access clipboard, get geolocation).

### How It Works

1. Bot sends a "request" **custom message** with `requestId` + action details + expiry
2. Frontend renders a confirmation UI (optional, based on permissions)
3. User approves (or action auto-executes if pre-approved)
4. Frontend sends response **event** back to bot with `requestId`
5. Bot receives response, **updates the message** to show status
6. If request expires, bot **updates the message** to show "expired"

**Key Design Decisions:**
- **Bot → Frontend uses messages** (not events) because:
  - Messages persist in chat history
  - Bot can UPDATE the message to show status (pending → approved/denied/expired)
  - Frontend can re-render on page refresh
- **Frontend → Bot uses events** because:
  - Events are fire-and-forget
  - No need to show response in chat
  - Frontend is always the responder, not initiator

This is the reverse of Pattern 2 - the bot is the "client" making requests to the frontend "server".

### Shared Types

```typescript
// bot/src/utils/shared-types.ts

// ============================================
// Bot → Frontend Request Types
// ============================================

// Request status - bot updates the message as status changes
export type BotRequestStatus =
  | "pending"      // Waiting for user response
  | "approved"     // User approved, action executed
  | "denied"       // User denied
  | "expired"      // Timeout reached
  | "cancelled"    // Bot cancelled the request
  | "error";       // Action failed after approval

// Base types for bot requests
export interface BotRequestBase {
  requestId: string;
  action: string;
  title: string;
  description?: string;
  icon?: string; // emoji or icon name
  requiresConfirmation: boolean;

  // Expiry settings
  expiresAt: string;      // ISO timestamp when request expires
  expiresInSeconds: number; // Original TTL for UI countdown display

  // Status tracking (bot updates this)
  status: BotRequestStatus;
  statusMessage?: string; // Optional message explaining status
  respondedAt?: string;   // When user responded
  result?: unknown;       // Result data after execution (for display)
}

export interface BotResponseBase {
  requestId: string;
  approved: boolean;
  error?: string;
}

// ============================================
// Browser Actions
// ============================================

export interface GetBrowserUrlRequest extends BotRequestBase {
  action: "browser:get-url";
}

export interface GetBrowserUrlResponse extends BotResponseBase {
  url?: string;
  title?: string;
}

export interface NavigateRequest extends BotRequestBase {
  action: "browser:navigate";
  params: {
    url: string;
    newTab?: boolean;
  };
}

export interface NavigateResponse extends BotResponseBase {
  navigated?: boolean;
}

export interface GetSelectionRequest extends BotRequestBase {
  action: "browser:get-selection";
}

export interface GetSelectionResponse extends BotResponseBase {
  selectedText?: string;
}

// ============================================
// Clipboard Actions
// ============================================

export interface CopyToClipboardRequest extends BotRequestBase {
  action: "clipboard:copy";
  params: {
    text: string;
  };
}

export interface CopyToClipboardResponse extends BotResponseBase {
  copied?: boolean;
}

export interface ReadClipboardRequest extends BotRequestBase {
  action: "clipboard:read";
}

export interface ReadClipboardResponse extends BotResponseBase {
  text?: string;
}

// ============================================
// Storage Actions
// ============================================

export interface GetLocalStorageRequest extends BotRequestBase {
  action: "storage:get";
  params: {
    key: string;
  };
}

export interface GetLocalStorageResponse extends BotResponseBase {
  value?: string;
}

export interface SetLocalStorageRequest extends BotRequestBase {
  action: "storage:set";
  params: {
    key: string;
    value: string;
  };
}

export interface SetLocalStorageResponse extends BotResponseBase {
  success?: boolean;
}

// ============================================
// Geolocation Actions
// ============================================

export interface GetLocationRequest extends BotRequestBase {
  action: "geo:get-location";
}

export interface GetLocationResponse extends BotResponseBase {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

// ============================================
// Union Types
// ============================================

export type BotRequest =
  | GetBrowserUrlRequest
  | NavigateRequest
  | GetSelectionRequest
  | CopyToClipboardRequest
  | ReadClipboardRequest
  | GetLocalStorageRequest
  | SetLocalStorageRequest
  | GetLocationRequest;

export type BotResponse =
  | GetBrowserUrlResponse
  | NavigateResponse
  | GetSelectionResponse
  | CopyToClipboardResponse
  | ReadClipboardResponse
  | GetLocalStorageResponse
  | SetLocalStorageResponse
  | GetLocationResponse;

// Map action to response type
export type BotRequestResponseMap = {
  "browser:get-url": GetBrowserUrlResponse;
  "browser:navigate": NavigateResponse;
  "browser:get-selection": GetSelectionResponse;
  "clipboard:copy": CopyToClipboardResponse;
  "clipboard:read": ReadClipboardResponse;
  "storage:get": GetLocalStorageResponse;
  "storage:set": SetLocalStorageResponse;
  "geo:get-location": GetLocationResponse;
};

// ============================================
// Permission Configuration
// ============================================

export interface ActionPermission {
  action: string;
  allowed: "always" | "ask" | "never";
}

export const DEFAULT_PERMISSIONS: Record<string, "always" | "ask" | "never"> = {
  "browser:get-url": "ask",
  "browser:navigate": "ask",
  "browser:get-selection": "ask",
  "clipboard:copy": "always",    // Usually safe
  "clipboard:read": "ask",       // Privacy sensitive
  "storage:get": "ask",
  "storage:set": "ask",
  "geo:get-location": "ask",     // Privacy sensitive
};
```

### Bot: Send Request to Frontend

```typescript
// bot/src/utils/bot-requests.ts

import { context } from "@botpress/runtime";
import type { BotRequest, BotRequestStatus } from "./shared-types";

// Default expiry times per action (in seconds)
const DEFAULT_EXPIRY: Record<string, number> = {
  "browser:get-url": 60,
  "browser:navigate": 30,
  "browser:get-selection": 60,
  "clipboard:copy": 30,
  "clipboard:read": 60,
  "storage:get": 60,
  "storage:set": 30,
  "geo:get-location": 120, // Geolocation may take longer
};

interface SendBotRequestOptions {
  expiresInSeconds?: number; // Override default expiry
}

/**
 * Send a request to the frontend.
 * Returns requestId and messageId for tracking.
 * The message can be updated later to reflect status changes.
 */
export async function sendBotRequest(
  request: Omit<BotRequest, "requestId" | "expiresAt" | "expiresInSeconds" | "status">,
  options: SendBotRequestOptions = {}
) {
  const client = context.get("client");
  const conversationId = context.get("conversationId");

  const requestId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_EXPIRY[request.action] ?? 60;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const fullRequest: BotRequest = {
    ...request,
    requestId,
    expiresAt,
    expiresInSeconds,
    status: "pending",
  } as BotRequest;

  // Send as custom message - frontend will render confirmation UI
  const { message } = await client.createMessage({
    conversationId,
    userId: context.get("botUserId"),
    type: "custom",
    payload: {
      url: "custom://bot-request",
      data: fullRequest,
    },
  });

  return { requestId, messageId: message.id };
}

/**
 * Update a bot request message status.
 * Call this when:
 * - User responds (approved/denied)
 * - Request expires
 * - Bot cancels the request
 * - Action completes with result
 */
export async function updateBotRequestStatus(
  messageId: string,
  status: BotRequestStatus,
  updates: {
    statusMessage?: string;
    respondedAt?: string;
    result?: unknown;
  } = {}
) {
  const client = context.get("client");

  // Get existing message
  const { message } = await client.getMessage({ id: messageId });
  const existingData = (message.payload as any).data as BotRequest;

  // Update with new status
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

/**
 * Cancel a pending bot request.
 */
export async function cancelBotRequest(messageId: string, reason?: string) {
  await updateBotRequestStatus(messageId, "cancelled", {
    statusMessage: reason || "Request cancelled by bot",
  });
}

/**
 * Mark a bot request as expired.
 */
export async function expireBotRequest(messageId: string) {
  await updateBotRequestStatus(messageId, "expired", {
    statusMessage: "Request timed out",
  });
}

// Convenience functions for common requests
export async function requestBrowserUrl() {
  return sendBotRequest({
    action: "browser:get-url",
    title: "Get Current URL",
    description: "The bot wants to know what page you're viewing",
    icon: "🔗",
    requiresConfirmation: true,
  });
}

export async function requestNavigate(url: string, newTab = false) {
  return sendBotRequest({
    action: "browser:navigate",
    title: "Navigate to Page",
    description: `The bot wants to open: ${url}`,
    icon: "🧭",
    requiresConfirmation: true,
    params: { url, newTab },
  } as any);
}

export async function requestCopyToClipboard(text: string) {
  return sendBotRequest({
    action: "clipboard:copy",
    title: "Copy to Clipboard",
    description: "The bot wants to copy text to your clipboard",
    icon: "📋",
    requiresConfirmation: false, // Usually auto-approved
    params: { text },
  } as any);
}

export async function requestGetSelection() {
  return sendBotRequest({
    action: "browser:get-selection",
    title: "Get Selected Text",
    description: "The bot wants to read your currently selected text",
    icon: "✂️",
    requiresConfirmation: true,
  });
}

export async function requestGeolocation() {
  return sendBotRequest({
    action: "geo:get-location",
    title: "Get Location",
    description: "The bot wants to access your current location",
    icon: "📍",
    requiresConfirmation: true,
  });
}
```

### Bot: Using Requests in Autonomous Tools

```typescript
// bot/src/conversations/index.ts

import { Autonomous, z } from "@botpress/runtime";
import { requestBrowserUrl, requestNavigate } from "../utils/bot-requests";

// Tool that requests browser URL from frontend
const getBrowserContext = new Autonomous.Tool({
  name: "get_browser_context",
  description: "Get the current browser URL and page title from the user's browser. Requires user approval.",
  input: z.object({}),
  output: z.object({
    requested: z.boolean(),
    requestId: z.string(),
  }),
  handler: async () => {
    const { requestId } = await requestBrowserUrl();

    // Return immediately - the response will come as a separate event
    return {
      requested: true,
      requestId,
      message: "Requested browser URL. Waiting for user approval...",
    };
  },
});

// Tool that navigates user's browser
const navigateBrowser = new Autonomous.Tool({
  name: "navigate_browser",
  description: "Navigate the user's browser to a specific URL. Requires user approval.",
  input: z.object({
    url: z.string().describe("The URL to navigate to"),
    newTab: z.boolean().optional().describe("Open in new tab"),
  }),
  output: z.object({
    requested: z.boolean(),
    requestId: z.string(),
  }),
  handler: async ({ url, newTab }) => {
    const { requestId } = await requestNavigate(url, newTab);

    return {
      requested: true,
      requestId,
      message: `Requested navigation to ${url}. Waiting for user approval...`,
    };
  },
});
```

### Frontend: Bot Request Handler Hook

```typescript
// frontend/src/hooks/useBotRequests.ts

import { useWebchat } from "@botpress/webchat";
import { useCallback, useState, useEffect, useRef } from "react";
import type {
  BotRequest,
  BotResponse,
  DEFAULT_PERMISSIONS,
} from "../types/shared";

// Load permissions from localStorage
function loadPermissions(): Record<string, "always" | "ask" | "never"> {
  try {
    const stored = localStorage.getItem("bot-action-permissions");
    return stored ? JSON.parse(stored) : { ...DEFAULT_PERMISSIONS };
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

function savePermissions(permissions: Record<string, "always" | "ask" | "never">) {
  localStorage.setItem("bot-action-permissions", JSON.stringify(permissions));
}

/**
 * Check if a request is still valid (not expired).
 */
function isRequestValid(request: BotRequest): boolean {
  if (request.status !== "pending") return false;
  const expiresAt = new Date(request.expiresAt).getTime();
  return Date.now() < expiresAt;
}

/**
 * Calculate remaining seconds until expiry.
 */
function getRemainingSeconds(request: BotRequest): number {
  const expiresAt = new Date(request.expiresAt).getTime();
  const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  return remaining;
}

export function useBotRequests() {
  const { client } = useWebchat();
  const [pendingRequest, setPendingRequest] = useState<BotRequest | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [permissions, setPermissions] = useState(loadPermissions);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear countdown timer
  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // Start countdown timer for pending request
  const startCountdown = useCallback((request: BotRequest) => {
    clearCountdown();

    setRemainingSeconds(getRemainingSeconds(request));

    countdownRef.current = setInterval(() => {
      const remaining = getRemainingSeconds(request);
      setRemainingSeconds(remaining);

      // Auto-expire on frontend when time runs out
      if (remaining <= 0) {
        clearCountdown();
        setPendingRequest(null);
        // Note: Bot will update the message status via its own expiry check
      }
    }, 1000);
  }, [clearCountdown]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearCountdown();
  }, [clearCountdown]);

  // Send response back to bot (always via event)
  const sendResponse = useCallback(
    async (requestId: string, response: Omit<BotResponse, "requestId">) => {
      if (!client) return;

      await client.sendEvent({
        eventType: "bot-request:response",
        data: { ...response, requestId },
      });
    },
    [client]
  );

  // Execute the action
  const executeAction = useCallback(
    async (request: BotRequest): Promise<Partial<BotResponse>> => {
      switch (request.action) {
        case "browser:get-url":
          return {
            approved: true,
            url: window.location.href,
            title: document.title,
          };

        case "browser:navigate": {
          const { url, newTab } = (request as any).params;
          if (newTab) {
            window.open(url, "_blank");
          } else {
            window.location.href = url;
          }
          return { approved: true, navigated: true };
        }

        case "browser:get-selection":
          return {
            approved: true,
            selectedText: window.getSelection()?.toString() || "",
          };

        case "clipboard:copy": {
          const { text } = (request as any).params;
          await navigator.clipboard.writeText(text);
          return { approved: true, copied: true };
        }

        case "clipboard:read": {
          const text = await navigator.clipboard.readText();
          return { approved: true, text };
        }

        case "storage:get": {
          const { key } = (request as any).params;
          return {
            approved: true,
            value: localStorage.getItem(key) || undefined,
          };
        }

        case "storage:set": {
          const { key, value } = (request as any).params;
          localStorage.setItem(key, value);
          return { approved: true, success: true };
        }

        case "geo:get-location":
          return new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                resolve({
                  approved: true,
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude,
                  accuracy: pos.coords.accuracy,
                });
              },
              (err) => {
                resolve({
                  approved: false,
                  error: err.message,
                });
              }
            );
          });

        default:
          return { approved: false, error: "Unknown action" };
      }
    },
    []
  );

  // Handle incoming bot requests (from new messages OR page refresh)
  const handleBotRequest = useCallback(
    async (request: BotRequest) => {
      // Check if request is still valid
      if (!isRequestValid(request)) {
        // Request already expired or handled - don't show UI
        return;
      }

      const permission = permissions[request.action] || "ask";

      // Check if auto-denied
      if (permission === "never") {
        await sendResponse(request.requestId, {
          approved: false,
          error: "Action permanently denied by user",
        });
        return;
      }

      // Check if auto-approved or doesn't require confirmation
      if (permission === "always" || !request.requiresConfirmation) {
        try {
          const result = await executeAction(request);
          await sendResponse(request.requestId, result as BotResponse);
        } catch (err: any) {
          await sendResponse(request.requestId, {
            approved: false,
            error: err.message || "Action failed",
          });
        }
        return;
      }

      // Show confirmation UI with countdown
      setPendingRequest(request);
      startCountdown(request);
    },
    [permissions, sendResponse, executeAction, startCountdown]
  );

  // User approves the request
  const approveRequest = useCallback(
    async (alwaysAllow: boolean) => {
      if (!pendingRequest) return;

      clearCountdown();

      // Check if still valid (might have expired while dialog was open)
      if (!isRequestValid(pendingRequest)) {
        setPendingRequest(null);
        return;
      }

      // Update permissions if "always allow" checked
      if (alwaysAllow) {
        const newPermissions = { ...permissions, [pendingRequest.action]: "always" as const };
        setPermissions(newPermissions);
        savePermissions(newPermissions);
      }

      try {
        const result = await executeAction(pendingRequest);
        await sendResponse(pendingRequest.requestId, result as BotResponse);
      } catch (err: any) {
        await sendResponse(pendingRequest.requestId, {
          approved: false,
          error: err.message || "Action failed",
        });
      }

      setPendingRequest(null);
    },
    [pendingRequest, permissions, executeAction, sendResponse, clearCountdown]
  );

  // User denies the request
  const denyRequest = useCallback(
    async (alwaysDeny: boolean) => {
      if (!pendingRequest) return;

      clearCountdown();

      // Update permissions if "always deny" checked
      if (alwaysDeny) {
        const newPermissions = { ...permissions, [pendingRequest.action]: "never" as const };
        setPermissions(newPermissions);
        savePermissions(newPermissions);
      }

      await sendResponse(pendingRequest.requestId, {
        approved: false,
        error: "User denied the request",
      });

      setPendingRequest(null);
    },
    [pendingRequest, permissions, sendResponse, clearCountdown]
  );

  // Reset a permission to "ask"
  const resetPermission = useCallback((action: string) => {
    const newPermissions = { ...permissions, [action]: "ask" as const };
    setPermissions(newPermissions);
    savePermissions(newPermissions);
  }, [permissions]);

  return {
    pendingRequest,
    remainingSeconds,
    permissions,
    handleBotRequest,
    approveRequest,
    denyRequest,
    resetPermission,
  };
}
```

### Frontend: Confirmation Dialog Component

```typescript
// frontend/src/components/BotRequestConfirmation.tsx

import { type FC, useState } from "react";
import type { BotRequest } from "../types/shared";

interface Props {
  request: BotRequest;
  remainingSeconds: number;
  onApprove: (alwaysAllow: boolean) => void;
  onDeny: (alwaysDeny: boolean) => void;
}

/**
 * Format seconds as MM:SS or just SS if under a minute.
 */
function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

const BotRequestConfirmation: FC<Props> = ({
  request,
  remainingSeconds,
  onApprove,
  onDeny,
}) => {
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [alwaysDeny, setAlwaysDeny] = useState(false);

  const isExpiring = remainingSeconds <= 10;

  return (
    <div className="bot-request-confirmation">
      <div className="bot-request-header">
        <span className="bot-request-icon">{request.icon || "🤖"}</span>
        <h3 className="bot-request-title">{request.title}</h3>
        <span className={`bot-request-timer ${isExpiring ? "expiring" : ""}`}>
          {formatTime(remainingSeconds)}
        </span>
      </div>

      {request.description && (
        <p className="bot-request-description">{request.description}</p>
      )}

      {/* Show parameters if present */}
      {"params" in request && request.params && (
        <div className="bot-request-params">
          <strong>Parameters:</strong>
          <pre>{JSON.stringify(request.params, null, 2)}</pre>
        </div>
      )}

      <div className="bot-request-permissions">
        <label className="bot-request-checkbox">
          <input
            type="checkbox"
            checked={alwaysAllow}
            onChange={(e) => {
              setAlwaysAllow(e.target.checked);
              if (e.target.checked) setAlwaysDeny(false);
            }}
          />
          Always allow this action
        </label>

        <label className="bot-request-checkbox">
          <input
            type="checkbox"
            checked={alwaysDeny}
            onChange={(e) => {
              setAlwaysDeny(e.target.checked);
              if (e.target.checked) setAlwaysAllow(false);
            }}
          />
          Always deny this action
        </label>
      </div>

      <div className="bot-request-actions">
        <button
          className="bot-request-deny"
          onClick={() => onDeny(alwaysDeny)}
        >
          Deny
        </button>
        <button
          className="bot-request-approve"
          onClick={() => onApprove(alwaysAllow)}
        >
          Allow
        </button>
      </div>
    </div>
  );
};

export default BotRequestConfirmation;
```

### Frontend: Render in Custom Block

The custom block renderer reads the request status from the message data (which the bot updates).
This means on page refresh, the UI automatically shows the correct state.

```typescript
// frontend/src/components/CustomBlockRenderer.tsx

import BotRequestConfirmation from "./BotRequestConfirmation";
import type { BotRequest, BotRequestStatus } from "../types/shared";

// Status display config
const STATUS_CONFIG: Record<BotRequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "pending" },
  approved: { label: "Approved", className: "approved" },
  denied: { label: "Denied", className: "denied" },
  expired: { label: "Expired", className: "expired" },
  cancelled: { label: "Cancelled", className: "cancelled" },
  error: { label: "Error", className: "error" },
};

// Inside CustomBlockRenderer component:

// Bot request (confirmation UI or status display)
if (url === "custom://bot-request" && data) {
  const request = data as BotRequest;

  // If this request is pending AND we're showing the confirmation dialog for it
  if (
    request.status === "pending" &&
    props.pendingRequest?.requestId === request.requestId
  ) {
    return (
      <BotRequestConfirmation
        request={request}
        remainingSeconds={props.remainingSeconds}
        onApprove={props.onBotRequestApprove!}
        onDeny={props.onBotRequestDeny!}
      />
    );
  }

  // Show status indicator (for completed, expired, or non-active pending requests)
  const statusConfig = STATUS_CONFIG[request.status];

  return (
    <div className={`bot-request-status ${statusConfig.className}`}>
      <span className="bot-request-icon">{request.icon || "🤖"}</span>
      <span className="bot-request-title">{request.title}</span>
      <span className={`bot-request-badge ${statusConfig.className}`}>
        {statusConfig.label}
      </span>
      {request.statusMessage && (
        <span className="bot-request-message">{request.statusMessage}</span>
      )}
      {/* Optionally show result data for approved requests */}
      {request.status === "approved" && request.result && (
        <div className="bot-request-result">
          <pre>{JSON.stringify(request.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### Frontend: Wire Up in App (with Page Refresh Handling)

```typescript
// frontend/src/App.tsx

import { useBotRequests } from "./hooks/useBotRequests";

function ChatContent() {
  const { client, messages } = useWebchat();
  const {
    pendingRequest,
    remainingSeconds,
    permissions,
    handleBotRequest,
    approveRequest,
    denyRequest,
  } = useBotRequests();

  // Scan existing messages for pending bot requests on mount/refresh
  // This ensures pending requests survive page refresh
  useEffect(() => {
    if (!messages?.length) return;

    // Find all bot-request messages that are still pending
    for (const message of messages) {
      if (message.payload?.url === "custom://bot-request") {
        const request = message.payload.data as BotRequest;

        // Only handle pending requests that haven't expired
        if (request.status === "pending") {
          const expiresAt = new Date(request.expiresAt).getTime();
          if (Date.now() < expiresAt) {
            handleBotRequest(request);
            break; // Only show one confirmation at a time
          }
        }
      }
    }
  }, [messages, handleBotRequest]);

  // Listen for NEW bot request messages (real-time)
  useEffect(() => {
    if (!client) return;

    const handleMessage = (message: any) => {
      if (message.payload?.url === "custom://bot-request") {
        const request = message.payload.data as BotRequest;
        // Only handle new pending requests
        if (request.status === "pending") {
          handleBotRequest(request);
        }
      }
    };

    client.on("message", handleMessage);
    return () => client.off("message", handleMessage);
  }, [client, handleBotRequest]);

  const renderCustomBlock = useCallback(
    (block: BlockObjects["custom"]) => (
      <CustomBlockRenderer
        {...block}
        pendingRequest={pendingRequest}
        remainingSeconds={remainingSeconds}
        onBotRequestApprove={approveRequest}
        onBotRequestDeny={denyRequest}
        // ... other props
      />
    ),
    [pendingRequest, remainingSeconds, approveRequest, denyRequest]
  );

  // ... rest of component
}
```

### Bot: Handle Response Events (with Message Status Update)

```typescript
// bot/src/handlers/bot-requests.handler.ts

import type { HandlerContext, HandlerResult } from "./types";
import type { RequestEvent } from "../utils/shared-types";
import { updateBotRequestStatus } from "../utils/bot-requests";

// Track pending requests: requestId -> messageId mapping
// In production, store this in conversation state
const pendingRequests = new Map<string, string>();

export function trackPendingRequest(requestId: string, messageId: string) {
  pendingRequests.set(requestId, messageId);
}

export async function handleBotRequestResponses(
  event: RequestEvent,
  ctx: HandlerContext
): Promise<HandlerResult> {
  // This handles "bot-request:response" events from frontend
  if (event.type !== "bot-request:response") {
    return { handled: false };
  }

  const { requestId, approved, error, ...responseData } = event.data;

  // Find the original message to update its status
  const messageId = pendingRequests.get(requestId);
  if (messageId) {
    // Update the message to reflect the response
    await updateBotRequestStatus(
      messageId,
      approved ? "approved" : "denied",
      {
        respondedAt: new Date().toISOString(),
        statusMessage: approved ? "Action completed" : (error || "User denied"),
        result: approved ? responseData : undefined,
      }
    );
    pendingRequests.delete(requestId);
  }

  // Store the response in conversation state for the agent to access
  if (!ctx.state.botRequestResponses) {
    ctx.state.botRequestResponses = {};
  }
  ctx.state.botRequestResponses[requestId] = {
    approved,
    error,
    ...responseData,
    receivedAt: new Date().toISOString(),
  };

  // Continue to agent so it can process the response
  return { handled: true, continueToAgent: true };
}

/**
 * Check for expired requests and update their status.
 * Call this periodically or at the start of each conversation handler.
 */
export async function expireStaleRequests(ctx: HandlerContext) {
  const now = Date.now();

  for (const [requestId, messageId] of pendingRequests.entries()) {
    // Get the message to check expiry
    const { message } = await ctx.client.getMessage({ id: messageId });
    const request = (message.payload as any).data;

    if (request.status === "pending") {
      const expiresAt = new Date(request.expiresAt).getTime();
      if (now > expiresAt) {
        // Mark as expired
        await updateBotRequestStatus(messageId, "expired", {
          statusMessage: "Request timed out",
        });
        pendingRequests.delete(requestId);
      }
    }
  }
}
```

### Bot: Updated Request Sender with Tracking

```typescript
// bot/src/utils/bot-requests.ts (updated)

import { trackPendingRequest } from "../handlers/bot-requests.handler";

// Update sendBotRequest to track the pending request
export async function sendBotRequest(
  request: Omit<BotRequest, "requestId" | "expiresAt" | "expiresInSeconds" | "status">,
  options: SendBotRequestOptions = {}
) {
  // ... existing code to create message ...

  const { requestId, messageId } = await createBotRequestMessage(request, options);

  // Track for status updates when response arrives
  trackPendingRequest(requestId, messageId);

  return { requestId, messageId };
}
```

### Bot: Agent Tool to Check Response

```typescript
// Tool for agent to check if a bot request was answered
const checkBotRequestResponse = new Autonomous.Tool({
  name: "check_bot_request_response",
  description: "Check if a previous bot request (like get_browser_url) has been answered by the user",
  input: z.object({
    requestId: z.string().describe("The requestId from the original request"),
  }),
  output: z.object({
    hasResponse: z.boolean(),
    approved: z.boolean().optional(),
    data: z.any().optional(),
    error: z.string().optional(),
  }),
  handler: async ({ requestId }) => {
    const response = state.botRequestResponses?.[requestId];

    if (!response) {
      return { hasResponse: false };
    }

    return {
      hasResponse: true,
      approved: response.approved,
      data: response,
      error: response.error,
    };
  },
});
```

### Permission Management UI (Optional)

```typescript
// frontend/src/components/PermissionSettings.tsx

import { type FC } from "react";
import type { ActionPermission } from "../types/shared";

interface Props {
  permissions: Record<string, "always" | "ask" | "never">;
  onReset: (action: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  "browser:get-url": "Read Browser URL",
  "browser:navigate": "Navigate Browser",
  "browser:get-selection": "Read Selected Text",
  "clipboard:copy": "Copy to Clipboard",
  "clipboard:read": "Read Clipboard",
  "storage:get": "Read Local Storage",
  "storage:set": "Write Local Storage",
  "geo:get-location": "Access Location",
};

const PermissionSettings: FC<Props> = ({ permissions, onReset }) => {
  return (
    <div className="permission-settings">
      <h3>Bot Permissions</h3>
      <p>Manage what the bot can do without asking:</p>

      <ul className="permission-list">
        {Object.entries(permissions).map(([action, permission]) => (
          <li key={action} className="permission-item">
            <span className="permission-label">
              {ACTION_LABELS[action] || action}
            </span>
            <span className={`permission-status permission-${permission}`}>
              {permission}
            </span>
            {permission !== "ask" && (
              <button
                className="permission-reset"
                onClick={() => onReset(action)}
              >
                Reset
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PermissionSettings;
```

### CSS Styles

```css
/* Bot Request Confirmation Styles */
.bot-request-confirmation {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
}

.bot-request-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.bot-request-icon {
  font-size: 24px;
}

.bot-request-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.bot-request-description {
  color: #6c757d;
  margin: 8px 0;
}

.bot-request-params {
  background: #e9ecef;
  padding: 8px;
  border-radius: 4px;
  margin: 8px 0;
  font-family: monospace;
  font-size: 12px;
}

.bot-request-params pre {
  margin: 4px 0 0 0;
  white-space: pre-wrap;
}

.bot-request-permissions {
  margin: 12px 0;
}

.bot-request-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  font-size: 13px;
  color: #6c757d;
  cursor: pointer;
}

.bot-request-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.bot-request-deny {
  flex: 1;
  padding: 8px 16px;
  border: 1px solid #dc3545;
  background: white;
  color: #dc3545;
  border-radius: 4px;
  cursor: pointer;
}

.bot-request-deny:hover {
  background: #dc3545;
  color: white;
}

.bot-request-approve {
  flex: 1;
  padding: 8px 16px;
  border: none;
  background: #28a745;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}

.bot-request-approve:hover {
  background: #218838;
}

.bot-request-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 14px;
}

.bot-request-badge {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  text-transform: uppercase;
}

.bot-request-badge.approved {
  background: #d4edda;
  color: #155724;
}

.bot-request-badge.denied {
  background: #f8d7da;
  color: #721c24;
}

.bot-request-badge.pending {
  background: #fff3cd;
  color: #856404;
}

.bot-request-badge.expired {
  background: #e9ecef;
  color: #6c757d;
}

.bot-request-badge.cancelled {
  background: #e9ecef;
  color: #6c757d;
}

.bot-request-badge.error {
  background: #f8d7da;
  color: #721c24;
}

/* Timer styles */
.bot-request-timer {
  margin-left: auto;
  padding: 4px 8px;
  background: #e9ecef;
  border-radius: 4px;
  font-family: monospace;
  font-size: 14px;
  font-weight: 600;
  color: #495057;
}

.bot-request-timer.expiring {
  background: #f8d7da;
  color: #721c24;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* Result display */
.bot-request-result {
  margin-top: 8px;
  padding: 8px;
  background: #e9ecef;
  border-radius: 4px;
  font-family: monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 150px;
}

.bot-request-result pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Status message */
.bot-request-message {
  font-size: 12px;
  color: #6c757d;
  margin-left: 8px;
}
```

### Key Concepts

1. **Async Request/Response**: Bot sends request message, frontend responds with event
2. **Permission System**: Three levels - "always", "ask", "never"
3. **Persistent Preferences**: Stored in localStorage, survives sessions
4. **Confirmation UI**: Shows action details, params, and "always allow/deny" checkboxes
5. **Request Status Tracking**: UI shows pending/approved/denied/expired/cancelled status
6. **Request Expiry**:
   - Each request has an `expiresAt` timestamp and `expiresInSeconds` for countdown
   - Frontend shows countdown timer in confirmation dialog
   - Timer pulses red when <= 10 seconds remaining
   - Frontend auto-dismisses dialog when time runs out
   - Bot updates message status to "expired" when timeout is reached
7. **Page Refresh Persistence**:
   - Request status is stored in the message payload (not just frontend state)
   - On page refresh, frontend scans messages for pending requests
   - If request is still valid (not expired), show confirmation dialog
   - Status badge reflects current state from message data
8. **Messages vs Events**:
   - Bot → Frontend: Uses **messages** (persist in chat, can be updated)
   - Frontend → Bot: Uses **events** (fire-and-forget, no chat history)
   - This allows bot to update request status (pending → approved/expired/etc.)

### Security Considerations

- **Sensitive actions default to "ask"**: Clipboard read, geolocation, storage access
- **Safe actions can default to "always"**: Clipboard write (copy)
- **Users can revoke permissions**: Reset button in settings
- **Clear descriptions**: Users know exactly what the bot is requesting
- **Parameter visibility**: Users see the exact data being accessed/modified

---

## Scaling: Splitting Large Conversation Handlers

When handling many events (50+), the conversation handler becomes unwieldy. Here's a strategy to split it into smaller, maintainable files.

### File Structure

```
bot/src/
├── conversations/
│   └── index.ts              # Main conversation, orchestrates handlers
├── handlers/
│   ├── index.ts              # Re-exports all handlers
│   ├── types.ts              # Shared handler types
│   ├── auth.handler.ts       # Auth events (login, signup, logout)
│   ├── profile.handler.ts    # Profile events (get, update)
│   ├── tools.handler.ts      # Tool events (approve, decline)
│   ├── content.handler.ts    # Content events (posts, ideas)
│   └── admin.handler.ts      # Admin events
└── utils/
    ├── shared-types.ts       # All type definitions
    └── event-guards.ts       # Event extraction
```

### Handler Interface

```typescript
// bot/src/handlers/types.ts

import type { RequestEvent } from "../utils/shared-types";

// Context passed to all handlers
export interface HandlerContext {
  client: BotpressClient;
  user: UserState;
  state: ConversationState;
  conversationId: string;
}

// Handler result
export interface HandlerResult {
  handled: boolean;          // Was this event handled?
  continueToAgent?: boolean; // Should autonomous agent run after?
}

// Handler function signature
export type EventHandler = (
  event: RequestEvent,
  ctx: HandlerContext
) => Promise<HandlerResult>;

// Handler registry entry
export interface HandlerRegistration {
  // Event type prefix this handler covers (e.g., "auth:", "profile:")
  prefix: string;
  handler: EventHandler;
}
```

### Individual Handler Files

```typescript
// bot/src/handlers/auth.handler.ts

import type { HandlerContext, HandlerResult } from "./types";
import type { RequestEvent } from "../utils/shared-types";
import {
  sendAuthLoginResponse,
  sendAuthSignupResponse,
  sendAuthLogoutResponse,
} from "../utils/response-senders";
import { authenticateUser, createUser } from "../utils/auth";

export async function handleAuthEvents(
  event: RequestEvent,
  ctx: HandlerContext
): Promise<HandlerResult> {
  const { requestId } = event.data;

  switch (event.type) {
    case "auth:login:request": {
      const { username, password } = event.data;

      try {
        const userRecord = await authenticateUser(username, password);

        if (userRecord) {
          ctx.user.state.isLoggedIn = true;
          ctx.user.state.username = userRecord.username;

          await sendAuthLoginResponse({
            requestId,
            success: true,
            username: userRecord.username,
          });

          // Continue to agent so bot can greet user
          return { handled: true, continueToAgent: true };
        } else {
          await sendAuthLoginResponse({
            requestId,
            success: false,
            error: "Invalid credentials",
          });
          return { handled: true };
        }
      } catch (err) {
        await sendAuthLoginResponse({
          requestId,
          success: false,
          error: "Authentication failed",
        });
        return { handled: true };
      }
    }

    case "auth:signup:request": {
      const { username, password } = event.data;

      try {
        const newUser = await createUser(username, password);

        ctx.user.state.isLoggedIn = true;
        ctx.user.state.username = newUser.username;

        await sendAuthSignupResponse({
          requestId,
          success: true,
          username: newUser.username,
        });

        // Continue to agent so bot can welcome new user
        return { handled: true, continueToAgent: true };
      } catch (err: any) {
        await sendAuthSignupResponse({
          requestId,
          success: false,
          error: err.message || "Signup failed",
        });
        return { handled: true };
      }
    }

    case "auth:logout:request": {
      ctx.user.state.isLoggedIn = false;
      ctx.user.state.username = undefined;

      await sendAuthLogoutResponse({
        requestId,
        success: true,
      });
      return { handled: true };
    }

    default:
      return { handled: false };
  }
}
```

```typescript
// bot/src/handlers/profile.handler.ts

import type { HandlerContext, HandlerResult } from "./types";
import type { RequestEvent } from "../utils/shared-types";
import {
  sendProfileGetResponse,
  sendProfileUpdateResponse,
} from "../utils/response-senders";

export async function handleProfileEvents(
  event: RequestEvent,
  ctx: HandlerContext
): Promise<HandlerResult> {
  const { requestId } = event.data;

  switch (event.type) {
    case "profile:get:request": {
      try {
        const { rows } = await ctx.client.findTableRows({
          table: "UsersTable",
          filter: { id: { $eq: Number(ctx.user.state.odataId) } },
          limit: 1,
        });

        await sendProfileGetResponse({
          requestId,
          success: true,
          profile: rows[0] || null,
        });
        return { handled: true };
      } catch (err) {
        await sendProfileGetResponse({
          requestId,
          success: false,
          error: "Failed to fetch profile",
        });
        return { handled: true };
      }
    }

    case "profile:update:request": {
      const { fields } = event.data;

      try {
        await ctx.client.updateTableRows({
          table: "UsersTable",
          rows: [{ id: Number(ctx.user.state.odataId), ...fields }],
        });

        await sendProfileUpdateResponse({
          requestId,
          success: true,
          updatedFields: Object.keys(fields),
        });
        return { handled: true };
      } catch (err) {
        await sendProfileUpdateResponse({
          requestId,
          success: false,
          error: "Failed to update profile",
        });
        return { handled: true };
      }
    }

    default:
      return { handled: false };
  }
}
```

### Handler Registry

```typescript
// bot/src/handlers/index.ts

import type { HandlerRegistration, HandlerContext, HandlerResult } from "./types";
import type { RequestEvent } from "../utils/shared-types";
import { handleAuthEvents } from "./auth.handler";
import { handleProfileEvents } from "./profile.handler";
import { handleToolEvents } from "./tools.handler";
import { handleContentEvents } from "./content.handler";

// Register all handlers with their prefixes
const handlers: HandlerRegistration[] = [
  { prefix: "auth:", handler: handleAuthEvents },
  { prefix: "profile:", handler: handleProfileEvents },
  { prefix: "tool:", handler: handleToolEvents },
  { prefix: "content:", handler: handleContentEvents },
];

/**
 * Route an event to the appropriate handler based on event type prefix.
 */
export async function routeEvent(
  event: RequestEvent,
  ctx: HandlerContext
): Promise<HandlerResult> {
  // Find handler by prefix
  for (const { prefix, handler } of handlers) {
    if (event.type.startsWith(prefix)) {
      const result = await handler(event, ctx);
      if (result.handled) {
        return result;
      }
    }
  }

  // No handler found
  return { handled: false };
}

// Re-export types
export type { HandlerContext, HandlerResult } from "./types";
```

### Clean Conversation Handler

```typescript
// bot/src/conversations/index.ts

import { Conversation, z, user, context } from "@botpress/runtime";
import { extractRequestEvent } from "../utils/event-guards";
import { routeEvent } from "../handlers";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  events: ["webchat:trigger"],
  state: z.object({
    pendingSuggestion: z.object({ /* ... */ }).optional(),
    // ...
  }),
  handler: async ({ execute, state, event }) => {
    const client = context.get("client");
    const conversationId = context.get("conversationId");

    // Extract request event
    const requestEvent = extractRequestEvent(event);

    if (requestEvent) {
      // Build handler context
      const ctx = {
        client,
        user,
        state,
        conversationId,
      };

      // Route to appropriate handler
      const result = await routeEvent(requestEvent, ctx);

      if (result.handled && !result.continueToAgent) {
        return; // Event handled, don't run agent
      }

      // If continueToAgent is true, fall through to execute()
    }

    // Run autonomous agent for regular messages or after certain events
    await execute({
      model: "gpt-4",
      instructions: buildInstructions(user),
      tools: () => buildTools(state, user),
    });
  },
});

function buildInstructions(user: UserState): string {
  // Build dynamic instructions based on user state
  return `...`;
}

function buildTools(state: ConversationState, user: UserState) {
  // Build tools based on state
  return [...];
}
```

### Adding a New Event Type

When adding new events, you only touch the relevant files:

1. **Add types** to `shared-types.ts`:
```typescript
export interface MyNewRequest extends BaseRequest {
  someField: string;
}
export interface MyNewResponse extends BaseResponse {
  result?: string;
}
```

2. **Add to RequestEvent union** in `shared-types.ts`:
```typescript
export type RequestEvent =
  | ... existing ...
  | { type: "mynew:action:request"; data: MyNewRequest };
```

3. **Add response sender** to `response-senders.ts`:
```typescript
export const sendMyNewResponse = (data: MyNewResponse) =>
  sendResponse("mynew:action:response", data);
```

4. **Add case to relevant handler** (or create new handler file):
```typescript
case "mynew:action:request": {
  // handle...
  return { handled: true };
}
```

5. **Add validation** to `event-guards.ts`:
```typescript
case "mynew:action:request":
  if (isValidMyNewRequest(data)) {
    return { type, data };
  }
  break;
```

### Benefits of This Structure

- **Separation of concerns**: Each domain (auth, profile, tools) is isolated
- **Easy to test**: Handlers are pure functions with explicit dependencies
- **Easy to find code**: Event type prefix maps directly to file name
- **Scalable**: Adding new handlers doesn't bloat existing files
- **Type-safe**: Full TypeScript coverage through the chain
- **Flexible control flow**: `continueToAgent` flag lets each event decide

---

## Summary

| Pattern | Direction | Use Case | Frontend | Bot |
|---------|-----------|----------|----------|-----|
| 1. Fire-and-Forget | FE → Bot | Analytics, notifications | `client.sendEvent()` | `extractEvent()` |
| 2. Request/Response | FE → Bot → FE | Auth, CRUD, mutations | `useBotRequest().request()` | `extractRequestEvent()` + `sendXxxResponse()` |
| 3. Custom Blocks | Bot → FE | Rich UI in chat | `CustomBlockRenderer` | `sendToolSuggestion()` etc. |
| 4. Bot Requests | Bot → FE → Bot | Browser actions, clipboard, geo | `useBotRequests()` + confirmation UI | `sendBotRequest()` + `updateBotRequestStatus()` |

### Pattern 4 Lifecycle

```
Bot                           Frontend                        User
 │                               │                              │
 ├─[1]─createMessage(pending)───▶│                              │
 │     (request + expiry)        │                              │
 │                               ├─[2]─show confirmation────────▶│
 │                               │     (with countdown timer)   │
 │                               │                              │
 │                               │◀─[3]─approve/deny────────────┤
 │◀──[4]─sendEvent(response)─────┤                              │
 │                               │                              │
 ├─[5]─updateMessage(approved)──▶│                              │
 │     (or denied/expired)       │                              │
 │                               ├─[6]─render status badge──────▶│
 │                               │                              │
```

**Expiry Flow:**
- If user doesn't respond before `expiresAt`, frontend auto-dismisses dialog
- Bot periodically checks for stale requests and marks them "expired"
- On page refresh, frontend scans messages and re-shows valid pending requests

All types flow from `bot/src/utils/shared-types.ts` → imported by frontend for full type safety.

### Pattern Comparison

```
Pattern 2 (FE initiates):        Pattern 4 (Bot initiates):
┌──────────┐                     ┌──────────┐
│ Frontend │                     │   Bot    │
└────┬─────┘                     └────┬─────┘
     │ sendEvent(request)             │ createMessage(request)
     ▼                                ▼
┌──────────┐                     ┌──────────┐
│   Bot    │                     │ Frontend │
└────┬─────┘                     └────┬─────┘
     │ createMessage(response)        │ [show confirmation UI]
     ▼                                │ sendEvent(response)
┌──────────┐                          ▼
│ Frontend │                     ┌──────────┐
└──────────┘                     │   Bot    │
                                 └──────────┘
```
