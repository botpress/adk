import { user, z } from "@botpress/runtime";
import { PartialHandler } from "../types";
import { handleUpdateSettings, UpdateSettingsRequestSchema } from "./update-settings";
import { handleStartGame, StartGameRequestSchema } from "./start-game";
import { handleCloseGame, CloseGameRequestSchema } from "./close-game";

const GameRequestSchema = z.discriminatedUnion("type", [
  UpdateSettingsRequestSchema,
  StartGameRequestSchema,
  CloseGameRequestSchema,
]);

type GameRequest = z.infer<typeof GameRequestSchema>;

/**
 * Parse incoming event/message to extract a GameRequest
 */
function parseGameRequest(props: Parameters<PartialHandler>[0]): GameRequest | null {
  if (props.event?.type === "webchat:trigger") {
    // Event structure: props.event.payload.payload = { action, settings, ... }
    const innerPayload = (props.event.payload as any)?.payload;
    if (innerPayload?.action) {
      const data = { type: innerPayload.action, ...innerPayload };
      const parsed = GameRequestSchema.safeParse(data);
      if (parsed.success) {
        return parsed.data;
      } else {
        console.warn("[GameHost] Invalid game request:", parsed.error);
      }
    }
  } else if (
    props.message?.type === "text" &&
    props.message.payload.text.startsWith("{")
  ) {
    const parsed = GameRequestSchema.safeParse(
      JSON.parse(props.message.payload.text)
    );
    if (parsed.success) {
      return parsed.data;
    } else {
      console.warn(
        "[GameHost] Invalid game request in text message",
        parsed.error
      );
    }
  }
  return null;
}

export const gameHostHandler: PartialHandler = async (props) => {
  if (props.conversation.tags.type !== "game") {
    // Not a game conversation
    return { handled: false };
  }

  if (props.conversation.tags.creatorUserId !== user.id) {
    // Only the game creator handles these events
    return { handled: false };
  }

  const request = parseGameRequest(props);

  if (!request) {
    // Not a valid game request
    return { handled: true, continue: false };
  }

  switch (request.type) {
    case "update_settings":
      return handleUpdateSettings(props, request);
    case "start_game":
      return handleStartGame(props);
    case "close_game":
      return handleCloseGame(props);
    default:
      return { handled: true, continue: false };
  }
};
