import { useEffect, useRef, useCallback } from "react";
import { useImportData } from "../context/ImportDataContext";
import type { ImportData } from "../types/import";

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

type UseImportPollingParams = {
  messages: Message[];
  conversationId: string | undefined;
  clientId: string;
  userId: string | undefined;
};

export function useImportPolling({
  messages,
  conversationId,
  clientId,
  userId,
}: UseImportPollingParams) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const { updateImportMessage } = useImportData();

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
                const payload = (message as { payload?: { data?: ImportData } }).payload;

                if (payload?.data) {
                  updateImportMessage(messageId, payload.data);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error polling import messages:", error);
      }
    },
    [conversationId, clientId, userId, updateImportMessage]
  );

  useEffect(() => {
    if (!conversationId) {
      return;
    }

    const inProgressMessages = messages.filter((msg: Message) => {
      const blockType = msg.block?.type;
      const blockUrl = msg.block?.url;
      const status = msg.block?.data?.status;

      const isCustom = blockType === "custom";
      const isImport = blockUrl === "custom://csv_import_progress";

      if (isCustom && isImport) {
        return status === "pending" || status === "parsing" || status === "validating" || status === "importing";
      }
      return false;
    });

    if (inProgressMessages.length > 0) {
      const messageIds = inProgressMessages.map((m) => m.id);

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
