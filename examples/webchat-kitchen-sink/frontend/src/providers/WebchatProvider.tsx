import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useWebchat } from "@botpress/webchat";
import type { DemoId } from "@/App";

const STORAGE_KEY_PREFIX = "webchat-demo-";

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID;

interface UserCredentials {
  id: string;
  key: string;
}

interface StoredDemoData {
  user: UserCredentials;
  identifiedConversations: string[]; // Track which conversations have been identified
}

interface WebchatContextType {
  demoId: DemoId;
  user: UserCredentials;
  // From Botpress useWebchat
  clientState: "connected" | "connecting" | "error" | "disconnected";
  conversationId: string | undefined;
  messages: ReturnType<typeof useWebchat>["messages"];
  isTyping: boolean | undefined;
  client: ReturnType<typeof useWebchat>["client"];
  newConversation: () => Promise<void>;
  error: ReturnType<typeof useWebchat>["error"];
}

const WebchatContext = createContext<WebchatContextType | null>(null);

function getStorageKey(demoId: DemoId): string {
  return `${STORAGE_KEY_PREFIX}${demoId}`;
}

function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateUserKey(): string {
  return crypto.randomUUID();
}

function getOrCreateDemoData(demoId: DemoId): StoredDemoData {
  const storageKey = getStorageKey(demoId);
  const stored = localStorage.getItem(storageKey);

  if (stored) {
    try {
      const data = JSON.parse(stored) as StoredDemoData;
      // Ensure identifiedConversations exists (migration)
      if (!data.identifiedConversations) {
        data.identifiedConversations = [];
      }
      return data;
    } catch {
      // Invalid data, create fresh
    }
  }

  const newData: StoredDemoData = {
    user: {
      id: generateUserId(),
      key: generateUserKey(),
    },
    identifiedConversations: [],
  };
  localStorage.setItem(storageKey, JSON.stringify(newData));
  return newData;
}

function markConversationIdentified(demoId: DemoId, conversationId: string) {
  const storageKey = getStorageKey(demoId);
  const data = getOrCreateDemoData(demoId);
  if (!data.identifiedConversations.includes(conversationId)) {
    data.identifiedConversations.push(conversationId);
    localStorage.setItem(storageKey, JSON.stringify(data));
  }
}

function isConversationIdentified(demoId: DemoId, conversationId: string): boolean {
  const data = getOrCreateDemoData(demoId);
  return data.identifiedConversations.includes(conversationId);
}

interface WebchatProviderProps {
  demoId: DemoId;
  children: ReactNode;
}

export function WebchatProvider({ demoId, children }: WebchatProviderProps) {
  // Initialize user data synchronously on mount - no effects, no race conditions
  const [demoData] = useState(() => getOrCreateDemoData(demoId));
  const identifyingRef = useRef(false);

  // Use the Botpress webchat hook with our user credentials
  // Each demo has its own storageKey to isolate conversations
  const webchat = useWebchat({
    clientId: CLIENT_ID,
    // Pass user credentials to Botpress
    user: {
      userId: demoData.user.id,
      userToken: demoData.user.key,
    },
    // Use demo-specific storage key to isolate conversations
    storageKey: `bp-${demoId}`,
    storageLocation: "localStorage",
  });

  // Send identify event when connected to a new conversation
  useEffect(() => {
    if (
      webchat.clientState === "connected" &&
      webchat.client &&
      webchat.conversationId &&
      !isConversationIdentified(demoId, webchat.conversationId) &&
      !identifyingRef.current
    ) {
      identifyingRef.current = true;
      const conversationId = webchat.conversationId;

      webchat.client
        .sendEvent(
          {
            type: "identify",
            payload: {
              demoType: demoId,
            },
          },
          { bindConversation: true }
        )
        .then(() => {
          console.log(`Identified conversation ${conversationId} as ${demoId}`);
          markConversationIdentified(demoId, conversationId);
        })
        .catch((err) => {
          console.error("Failed to send identify event:", err);
        })
        .finally(() => {
          identifyingRef.current = false;
        });
    }
  }, [webchat.clientState, webchat.client, webchat.conversationId, demoId]);

  return (
    <WebchatContext.Provider
      value={{
        demoId,
        user: demoData.user,
        clientState: webchat.clientState,
        conversationId: webchat.conversationId,
        messages: webchat.messages,
        isTyping: webchat.isTyping,
        client: webchat.client,
        newConversation: webchat.newConversation,
        error: webchat.error,
      }}
    >
      {children}
    </WebchatContext.Provider>
  );
}

export function useWebchatDemo() {
  const context = useContext(WebchatContext);
  if (!context) {
    throw new Error("useWebchatDemo must be used within a WebchatProvider");
  }
  return context;
}
