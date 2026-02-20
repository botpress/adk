/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type FC, type ReactNode } from "react";
import type { IntegrationMessage } from "@botpress/webchat";

type SendMessageFn = (payload: IntegrationMessage["payload"]) => Promise<void>;

const SendMessageContext = createContext<SendMessageFn | null>(null);

export const useSendMessage = () => {
  const fn = useContext(SendMessageContext);
  if (!fn) {
    throw new Error("useSendMessage must be used within SendMessageProvider");
  }
  return fn;
};

type Props = {
  sendMessage: SendMessageFn;
  children: ReactNode;
};

export const SendMessageProvider: FC<Props> = ({ sendMessage, children }) => (
  <SendMessageContext.Provider value={sendMessage}>
    {children}
  </SendMessageContext.Provider>
);
