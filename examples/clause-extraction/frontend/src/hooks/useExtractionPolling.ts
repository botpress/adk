import { useEffect, useRef, useCallback } from "react";
import { useExtractionData } from "../context/ExtractionDataContext";
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

export function useExtractionPolling({
  messages,
  conversationId,
  clientId,
  userId,
}: UseExtractionPollingParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { updateExtractionData } = useExtractionData();

  const pollMessages = useCallback(
    async (messageIds: string[]) => {
      if (!conversationId || !clientId || !userId) {
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
            for (const messageId of messageIds) {
              const message = data.messages.find((m: { id: string }) => m.id === messageId);

              if (message) {
                const payload = (message as { payload?: { data?: ExtractionData } }).payload;

                if (payload?.data) {
                  console.log("Polling: Updating extraction message", messageId);
                  updateExtractionData(messageId, payload.data);
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
      const isExtraction = blockUrl === "custom://extraction_progress" || blockUrl === "custom://clause_extraction";

      if (isCustom && isExtraction) {
        return status === "in_progress";
      }
      return false;
    });

    if (inProgressExtractionMessages.length > 0) {
      const messageIds = inProgressExtractionMessages.map((m) => m.id);
      console.log("Polling started for", inProgressExtractionMessages.length, "extraction message(s)");

      intervalRef.current = setInterval(() => {
        pollMessages(messageIds);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [messages, conversationId, clientId, userId, pollMessages]);
}
