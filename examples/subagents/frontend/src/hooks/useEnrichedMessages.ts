import { useMemo } from "react";
import type { BlockMessage } from "@botpress/webchat";
import { BOT_CONFIG } from "../config/constants";

export function useEnrichedMessages(messages: BlockMessage[], userId?: string) {
  return useMemo(() => {
    // Filter out subagent messages that aren't "start" (they're grouped into the start card)
    const filtered = messages.filter((msg) => {
      const block = msg.block as any;
      if (block?.url === "subagent") {
        // Only keep "start" messages - others are rendered inside the card
        return block.data?.type === "start";
      }
      return true;
    });

    const enriched = filtered.map((message) => {
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

    // Find last user message index
    let lastUserIndex = -1;
    for (let i = enriched.length - 1; i >= 0; i--) {
      if (enriched[i].direction === "outgoing") {
        lastUserIndex = i;
        break;
      }
    }

    // Get timestamp - use data.ts for steps (more precise), fallback to message timestamp
    const getTs = (msg: typeof enriched[0]): number => {
      const stepTs = (msg.block as any).data?.ts;
      if (stepTs) return stepTs;
      return msg.timestamp?.getTime() ?? 0;
    };

    // Separate: messages before current turn, current turn
    const beforeTurn = enriched.slice(0, lastUserIndex + 1);
    const currentTurn = enriched.slice(lastUserIndex + 1);

    // Sort all current turn messages by timestamp
    const sortedCurrentTurn = [...currentTurn].sort((a, b) => getTs(a) - getTs(b));

    return [...beforeTurn, ...sortedCurrentTurn];
  }, [messages, userId]);
}
