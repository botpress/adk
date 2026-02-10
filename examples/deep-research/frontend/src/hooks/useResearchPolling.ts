import { useEffect, useRef, useCallback } from "react";
import { useResearchData } from "../context/ResearchDataContext";
import type { ResearchData } from "../types/research";

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

type UseResearchPollingParams = {
  messages: Message[];
  conversationId: string | undefined;
  clientId: string;
  userId: string | undefined;
};

/**
 * Polls the Botpress chat API for updates to in-progress research messages.
 * The workflow updates the message payload on the server as each phase completes,
 * but the webchat SDK doesn't push payload changes — so we poll every 1s and
 * sync updates into ResearchDataContext for the UI to re-render.
 * Stops automatically when the research reaches a terminal state.
 */
export function useResearchPolling({
  messages,
  conversationId,
  clientId,
  userId,
}: UseResearchPollingParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { updateResearchMessage } = useResearchData();

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
                const payload = (message as { payload?: { data?: ResearchData } }).payload;

                if (payload?.data) {
                  console.log("Polling: Updating research message", messageId);
                  updateResearchMessage(messageId, payload.data);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error polling messages:", error);
      }
    },
    [conversationId, clientId, userId, updateResearchMessage]
  );

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    // Find in-progress research messages
    const inProgressResearchMessages = messages.filter((msg: Message) => {
      const blockType = msg.block?.type;
      const blockUrl = msg.block?.url;
      const status = msg.block?.data?.status;

      const isCustom = blockType === "custom";
      const isResearch = blockUrl === "custom://research_progress";

      if (isCustom && isResearch) {
        return status === "in_progress";
      }
      return false;
    });

    if (inProgressResearchMessages.length > 0) {
      const messageIds = inProgressResearchMessages.map((m) => m.id);
      console.log("Polling started for", inProgressResearchMessages.length, "research message(s)");

      // Start polling
      intervalRef.current = setInterval(() => {
        pollMessages(messageIds);
      }, 1000);
    } else {
      // Stop polling if no in-progress research
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
