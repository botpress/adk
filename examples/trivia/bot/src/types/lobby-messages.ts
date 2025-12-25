import { z } from "@botpress/runtime";

// ============================================
// Lobby Request Messages (Frontend -> Bot)
// ============================================

export const LobbyInitSchema = z.object({
  type: z.literal("lobby_init"),
});

export const JoinRequestSchema = z.object({
  type: z.literal("join_request"),
  joinCode: z.string().min(1).max(10),
});

export const CreateRequestSchema = z.object({
  type: z.literal("create_request"),
  gameConversationId: z.string(),
});

export const LeaveRequestSchema = z.object({
  type: z.literal("leave_request"),
  gameConversationId: z.string(),
});

export const LobbyRequestSchema = z.discriminatedUnion("type", [
  LobbyInitSchema,
  JoinRequestSchema,
  CreateRequestSchema,
  LeaveRequestSchema,
]);

export type LobbyInit = z.infer<typeof LobbyInitSchema>;
export type JoinRequest = z.infer<typeof JoinRequestSchema>;
export type CreateRequest = z.infer<typeof CreateRequestSchema>;
export type LeaveRequest = z.infer<typeof LeaveRequestSchema>;
export type LobbyRequest = z.infer<typeof LobbyRequestSchema>;

// ============================================
// Lobby Response Messages (Bot -> Frontend)
// ============================================

export const LobbyInitResponseSchema = z.object({
  type: z.literal("lobby_init_response"),
  success: z.literal(true),
});

export const JoinResponseSchema = z.object({
  type: z.literal("join_response"),
  success: z.boolean(),
  conversationId: z.string().optional(),
  error: z.string().optional(),
});

export const CreateResponseSchema = z.object({
  type: z.literal("create_response"),
  success: z.boolean(),
  conversationId: z.string().optional(),
  joinCode: z.string().optional(),
  error: z.string().optional(),
});

export const LeaveResponseSchema = z.object({
  type: z.literal("leave_response"),
  success: z.boolean(),
  error: z.string().optional(),
});

export const RemovedFromGameNotificationSchema = z.object({
  type: z.literal("removed_from_game"),
  gameConversationId: z.string(),
});

export type LobbyInitResponse = z.infer<typeof LobbyInitResponseSchema>;
export type JoinResponse = z.infer<typeof JoinResponseSchema>;
export type CreateResponse = z.infer<typeof CreateResponseSchema>;
export type LeaveResponse = z.infer<typeof LeaveResponseSchema>;
export type RemovedFromGameNotification = z.infer<typeof RemovedFromGameNotificationSchema>;

export type LobbyResponse = LobbyInitResponse | JoinResponse | CreateResponse | LeaveResponse | RemovedFromGameNotification;

// ============================================
// Game Event Messages (Bot -> Frontend, sent in game conversation)
// ============================================

export const ParticipantAddedEventSchema = z.object({
  type: z.literal("participant_added"),
  userId: z.string(),
});

export const ParticipantRemovedEventSchema = z.object({
  type: z.literal("participant_removed"),
  userId: z.string(),
});

export const GameEventSchema = z.discriminatedUnion("type", [
  ParticipantAddedEventSchema,
  ParticipantRemovedEventSchema,
]);

export type ParticipantAddedEvent = z.infer<typeof ParticipantAddedEventSchema>;
export type ParticipantRemovedEvent = z.infer<typeof ParticipantRemovedEventSchema>;
export type GameEvent = z.infer<typeof GameEventSchema>;

// ============================================
// Helper to parse incoming lobby messages
// ============================================

export function parseLobbyRequest(text: string): LobbyRequest | null {
  try {
    const data = JSON.parse(text);
    const result = LobbyRequestSchema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    console.log("[Lobby] Failed to parse request:", result.error);
    return null;
  } catch {
    return null;
  }
}
