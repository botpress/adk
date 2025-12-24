// TODO: parse message

import { z } from "@bpinternal/zui";

export const JoinRequest = z.object({
  type: z.literal("join_request"),
  joinCode: z.string().min(1).max(10),
});

export const CreateRequest = z.object({
  type: z.literal("create_request"),
  maxPlayers: z.number().min(2).max(10).optional(),
  // todo: difficulty
  // todo: categories
  // todo: question count
  // todo: question type(s)
  // todo: scoring method
});
