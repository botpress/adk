import { CLIENT_ID } from "@/config/constants";
import {
  createClient,
  createUser,
  type Client,
  type Message,
} from "@botpress/webchat-client";
import {
  parseLobbyResponse,
  type JoinResponse,
  type CreateResponse,
  type LobbyResponse,
} from "@/types/lobby-messages";

type MessageHandler = (message: Message) => void;

class LobbyClient {
  private static instance: LobbyClient | null = null;
  private static initPromise: Promise<LobbyClient> | null = null;

  private client: Client;
  private userId: string;
  private conversationId: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private listenerCleanup: (() => void) | null = null;

  private constructor(client: Client, userId: string, conversationId: string) {
    this.client = client;
    this.userId = userId;
    this.conversationId = conversationId;
    this.setupListener();
  }

  private setupListener(): void {
    console.log("[LobbyClient] Setting up conversation listener");

    const listener = this.client.listenConversation({
      conversationId: this.conversationId,
    });

    const offInit = listener(
      "init",
      ({ conversation, messages, participants, user }) => {
        console.log("[LobbyClient] Listener initialized:", {
          conversationId: conversation.id,
          messageCount: messages.length,
          participantCount: participants.length,
          userId: user?.id,
        });
      }
    );

    const offMessage = listener("message_created", (event) => {
      console.log("[LobbyClient] Message received:", event);
      this.messageHandlers.forEach((handler) => handler(event as Message));
    });

    const offParticipantAdded = listener("participant_added", (event) => {
      console.log("[LobbyClient] Participant added:", event);
    });

    const offParticipantRemoved = listener("participant_removed", (event) => {
      console.log("[LobbyClient] Participant removed:", event);
    });

    // Store cleanup function
    this.listenerCleanup = () => {
      offInit();
      offMessage();
      offParticipantAdded();
      offParticipantRemoved();
      this.messageHandlers.clear();
    };
  }

  private onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  static async getInstance(): Promise<LobbyClient> {
    if (LobbyClient.instance) {
      return LobbyClient.instance;
    }

    if (LobbyClient.initPromise) {
      return LobbyClient.initPromise;
    }

    LobbyClient.initPromise = LobbyClient.initialize();

    try {
      LobbyClient.instance = await LobbyClient.initPromise;
      return LobbyClient.instance;
    } finally {
      LobbyClient.initPromise = null;
    }
  }

  private static async initialize(): Promise<LobbyClient> {
    console.log("[LobbyClient] Initializing...");

    const { client, userId } = await LobbyClient.getOrCreateUser();
    console.log("[LobbyClient] Got user:", userId);

    const { conversationId, isNew } = await LobbyClient.getOrCreateConversation(
      client,
      userId
    );
    console.log("[LobbyClient] Got conversation:", conversationId, { isNew });

    // Create instance and set up listener BEFORE sending lobby_init
    const instance = new LobbyClient(client, userId, conversationId);

    // If this is a new conversation, send lobby_init after listener is ready
    if (isNew) {
      await client.createMessage({
        conversationId,
        metadata: {},
        payload: {
          type: "text",
          text: JSON.stringify({ type: "lobby_init" }),
        },
      });
      console.log("[LobbyClient] Sent lobby_init");
    }

    return instance;
  }

  private static async getOrCreateUser(): Promise<{
    userId: string;
    token: string;
    client: Client;
  }> {
    const storageKey = `trivia-webchat-user-${CLIENT_ID}`;

    const createAndSaveUser = async () => {
      const { key, user } = await createUser({ clientId: CLIENT_ID });
      localStorage.setItem(
        storageKey,
        JSON.stringify({ userId: user.id, token: key })
      );
      return { userId: user.id, token: key };
    };

    const stored = localStorage.getItem(storageKey);
    let creds = stored ? JSON.parse(stored) : null;

    if (!creds?.userId || !creds?.token) {
      creds = await createAndSaveUser();
    }

    const client = createClient({ clientId: CLIENT_ID, userKey: creds.token });

    try {
      await client.getUser();
    } catch {
      creds = await createAndSaveUser();
    }

    return { userId: creds.userId, token: creds.token, client };
  }

  private static async getOrCreateConversation(
    client: Client,
    userId: string
  ): Promise<{ conversationId: string; isNew: boolean }> {
    const storageKey = `trivia-webchat-lobby-conversation-${CLIENT_ID}-${userId}`;
    let convoId = localStorage.getItem(storageKey);

    if (convoId) {
      try {
        await client.getConversation({ conversationId: convoId });
        console.log("[LobbyClient] Reusing existing conversation:", convoId);
        return { conversationId: convoId, isNew: false };
      } catch {
        console.log(
          "[LobbyClient] Stored conversation invalid, creating new one"
        );
        localStorage.removeItem(storageKey);
        convoId = null;
      }
    }

    const { conversation } = await client.createConversation();
    convoId = conversation.id;
    localStorage.setItem(storageKey, convoId);

    console.log("[LobbyClient] Created new conversation:", convoId);
    return { conversationId: convoId, isNew: true };
  }

  async joinGame(joinCode: string): Promise<{ conversationId: string }> {
    console.log("[LobbyClient] Joining game with code:", joinCode);

    const responsePromise = this.waitForResponse("join_response");

    await this.client.createMessage({
      conversationId: this.conversationId,
      metadata: {},
      payload: {
        type: "text",
        // TODO: use types shared with bot here to ensure consistency
        // IMPORT FROM BOT THE TYPES ONLY
        text: JSON.stringify({ type: "join_request", joinCode }),
      },
    });

    return responsePromise;
  }

  async createGame(): Promise<{ conversationId: string; joinCode: string }> {
    console.log("[LobbyClient] Creating new game");

    // Step 1: Create a new conversation for the game
    const { conversation: gameConversation } =
      await this.client.createConversation();
    console.log(
      "[LobbyClient] Created game conversation:",
      gameConversation.id
    );

    // Step 2: Set up listener for the response
    const responsePromise = this.waitForResponse("create_response");

    // Step 3: Send create_request to lobby with the new conversation ID
    await this.client.createMessage({
      conversationId: this.conversationId,
      metadata: {},
      payload: {
        type: "text",
        text: JSON.stringify({
          type: "create_request",
          gameConversationId: gameConversation.id,
        }),
      },
    });

    const response = await responsePromise;

    console.log("[LobbyClient] Create game response received:", response);
    return response as { conversationId: string; joinCode: string };
  }

  private waitForResponse(
    expectedType: "join_response" | "create_response"
  ): Promise<{ conversationId: string; joinCode?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timeout waiting for response"));
      }, 30000);

      const cleanup = this.onMessage((message) => {
        // Only process bot messages (userId !== our userId)
        if (message.userId === this.userId) return;
        if (message.payload.type !== "text") return;

        const text = (message.payload as { text: string }).text;
        const response = parseLobbyResponse(text);
        if (!response || response.type !== expectedType) return;

        console.log("[LobbyClient] Got response:", response);
        clearTimeout(timeout);
        cleanup();

        if (!response.success) {
          reject(new Error(response.error || `Failed: ${expectedType}`));
          return;
        }

        if (!response.conversationId) {
          reject(new Error("No conversation ID in response"));
          return;
        }

        resolve({
          conversationId: response.conversationId,
          joinCode:
            response.type === "create_response" ? response.joinCode : undefined,
        });
      });
    });
  }

  getConversationId(): string {
    return this.conversationId;
  }

  getUserId(): string {
    return this.userId;
  }

  destroy(): void {
    this.listenerCleanup?.();
    LobbyClient.instance = null;
  }
}

export { LobbyClient };
export type { JoinResponse, CreateResponse, LobbyResponse };
