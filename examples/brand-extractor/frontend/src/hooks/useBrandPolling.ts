import { useEffect, useRef, useCallback } from "react";
import { useBrandData } from "../context/BrandDataContext";
import type { BrandProgressData } from "../types/brand";

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

type UseBrandPollingParams = {
  messages: Message[];
  conversationId: string | undefined;
  clientId: string;
  userId: string | undefined;
};

/**
 * Polls the Botpress chat API for updates to in-progress brand extraction messages.
 * The workflow updates the message payload on the server as each step completes,
 * but the webchat SDK doesn't push payload changes — so we poll every 1s and
 * sync updates into BrandDataContext for the BrandCard to re-render.
 * Stops automatically when the extraction reaches a terminal state.
 */
export function useBrandPolling({
  messages,
  conversationId,
  clientId,
  userId,
}: UseBrandPollingParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { updateBrandMessage } = useBrandData();

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

          // Find and update the messages we're tracking
          if (data.messages && Array.isArray(data.messages)) {
            for (const messageId of messageIds) {
              const message = data.messages.find((m: { id: string }) => m.id === messageId);

              if (message) {
                const payload = (message as { payload?: { data?: BrandProgressData } }).payload;

                if (payload?.data) {
                  console.log("Polling: Updating brand message", messageId);
                  updateBrandMessage(messageId, payload.data);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error polling messages:", error);
      }
    },
    [conversationId, clientId, userId, updateBrandMessage]
  );

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    // Find in-progress brand extraction messages
    const inProgressBrandMessages = messages.filter((msg: Message) => {
      const blockType = msg.block?.type;
      const blockUrl = msg.block?.url;
      const status = msg.block?.data?.status;

      const isCustom = blockType === "custom";
      const isBrand = blockUrl === "custom://brand_progress";

      if (isCustom && isBrand) {
        return status === "in_progress";
      }
      return false;
    });

    if (inProgressBrandMessages.length > 0) {
      const messageIds = inProgressBrandMessages.map((m) => m.id);
      console.log("Polling started for", inProgressBrandMessages.length, "brand message(s)");

      // Start polling
      intervalRef.current = setInterval(() => {
        pollMessages(messageIds);
      }, 1000);
    } else {
      // Stop polling if no in-progress brand extraction
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
