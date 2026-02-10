import { useMemo } from "react";
import type { BlockMessage } from "@botpress/webchat";
import { BOT_CONFIG } from "../config/constants";

/**
 * Transforms raw webchat messages for display: filters out duplicate subagent
 * step messages, adds direction/sender metadata, and sorts the current turn's
 * messages by timestamp so steps appear in execution order.
 *
 * Subagent step filtering: each subagent invocation produces many custom
 * messages (start, thinking, tool, end). Only the "start" message is kept
 * in the message list — the rest are rendered inside the SubAgentCard via
 * useSubAgentGroups. Without this filter, each step would appear as a
 * separate message bubble.
 */
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

    // Find last user message index — everything after it is the "current turn"
    let lastUserIndex = -1;
    for (let i = enriched.length - 1; i >= 0; i--) {
      if (enriched[i].direction === "outgoing") {
        lastUserIndex = i;
        break;
      }
    }

    // Step messages carry a precise ts from Date.now() on the server.
    // Regular messages only have the webchat SDK timestamp.
    const getTs = (msg: typeof enriched[0]): number => {
      const stepTs = (msg.block as any).data?.ts;
      if (stepTs) return stepTs;
      return msg.timestamp?.getTime() ?? 0;
    };

    // Only sort the current turn — historical messages stay in their original order.
    // This ensures subagent steps interleave correctly with the orchestrator's
    // response when multiple subagents run for the same user message.
    const beforeTurn = enriched.slice(0, lastUserIndex + 1);
    const currentTurn = enriched.slice(lastUserIndex + 1);
    const sortedCurrentTurn = [...currentTurn].sort((a, b) => getTs(a) - getTs(b));

    return [...beforeTurn, ...sortedCurrentTurn];
  }, [messages, userId]);
}
