import { useEffect, useRef, useCallback } from "react";
import { useUpdateExtractionData } from "../context/ExtractionDataContext";
import type { ExtractionData } from "../types/extraction";

type Message = {
  id: string;
  type?: string;
  payload?: unknown;
  block?: {
    type?: string;
    url?: string;
    data?: {
      status?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type UseExtractionPollingParams = {
  messages: Message[];
  conversationId: string | undefined;
  clientId: string;
  userId: string | undefined;
};

/**
 * Polls the Botpress Chat API for custom message payload updates.
 * Why polling? The webchat SDK delivers new messages but doesn't push
 * payload changes to existing messages — so we poll to catch progress
 * updates written by the workflow via client.updateMessage().
 */
export function useExtractionPolling({
  messages,
  conversationId,
  clientId,
  userId,
}: UseExtractionPollingParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Ref (not state) to avoid re-renders on every poll cycle —
  // the actual UI update flows through ExtractionDataContext's store.
  const activeMessageIdsRef = useRef<Set<string>>(new Set());
  const updateExtractionData = useUpdateExtractionData();

  const pollMessages = useCallback(
    async (messageIds: string[]) => {
      if (!conversationId || !clientId || !userId) {
        return;
      }

      // Only poll messages that are still active
      const activeIds = messageIds.filter((id) => activeMessageIdsRef.current.has(id));
      if (activeIds.length === 0) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
        return;
      }

      const url = `https://chat.botpress.cloud/${clientId}/conversations/${conversationId}/messages`;

      try {
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "x-user-key": userId,
          },
        });

        if (response.ok) {
          const data = await response.json();

          if (data.messages && Array.isArray(data.messages)) {
            for (const messageId of activeIds) {
              const message = data.messages.find((m: { id: string }) => m.id === messageId);

              if (message) {
                const payload = (message as { payload?: { data?: ExtractionData } }).payload;

                if (payload?.data) {
                  updateExtractionData(messageId, payload.data);

                  // Stop polling this message when extraction completes
                  if (payload.data.status !== "in_progress") {
                    activeMessageIdsRef.current.delete(messageId);
                    console.log("Polling: Extraction complete, stopped polling", messageId);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error polling messages:", error);
      }
    },
    [conversationId, clientId, userId, updateExtractionData]
  );

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const inProgressExtractionMessages = messages.filter((msg: Message) => {
      const blockType = msg.block?.type;
      const blockUrl = msg.block?.url;
      const status = msg.block?.data?.status;

      const isCustom = blockType === "custom";
      // Support both extraction_progress (backend) and clause_extraction (legacy) URLs
      const isExtraction =
        blockUrl === "custom://extraction_progress" || blockUrl === "custom://clause_extraction";

      if (isCustom && isExtraction) {
        return status === "in_progress";
      }
      return false;
    });

    // Add new in-progress messages to active set
    for (const msg of inProgressExtractionMessages) {
      if (!activeMessageIdsRef.current.has(msg.id)) {
        activeMessageIdsRef.current.add(msg.id);
      }
    }

    // Start polling if we have active messages and no interval running
    if (activeMessageIdsRef.current.size > 0 && !intervalRef.current) {
      const messageIds = Array.from(activeMessageIdsRef.current);
      console.log("Polling: Started for", messageIds.length, "extraction message(s)");

      intervalRef.current = setInterval(() => {
        pollMessages(messageIds);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    };
  }, [messages, conversationId, clientId, userId, pollMessages]);
}
