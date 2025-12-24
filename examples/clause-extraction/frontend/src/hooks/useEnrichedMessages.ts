import { useMemo } from "react";
import type { BlockMessage } from "@botpress/webchat";
import { BOT_CONFIG } from "../config/constants";

export function useEnrichedMessages(messages: BlockMessage[], userId?: string) {
  return useMemo(() => {
    const enriched = messages.map((message) => {
      const { authorId } = message;
      const direction: "outgoing" | "incoming" = authorId === userId ? "outgoing" : "incoming";
      return {
        ...message,
        direction,
        sender:
          direction === "outgoing"
            ? { name: "You", avatar: undefined }
            : { name: BOT_CONFIG.name, avatar: BOT_CONFIG.avatar },
      };
    });

    return enriched;
  }, [messages, userId]);
}
