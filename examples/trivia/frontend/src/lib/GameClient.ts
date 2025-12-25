import {
  type Client,
  type Message,
  type ListParticipantsResponse,
} from "@botpress/webchat-client";
import { getWebchatClient } from "./webchat";
import { LobbyClient } from "./LobbyClient";
import { parseGameEvent, type GameEvent } from "@/types/lobby-messages";

type Participant = ListParticipantsResponse["participants"][number];

type MessageHandler = (message: Message) => void;
type ParticipantsChangedHandler = (participants: Participant[], event?: GameEvent) => void;

export type GameInitData = {
  conversationId: string;
  messages: Message[];
  participants: Participant[];
  userId: string;
};

class GameClient {
  private client: Client;
  private userId: string;
  private conversationId: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private participantsChangedHandlers: Set<ParticipantsChangedHandler> = new Set();
  private listenerCleanup: (() => void) | null = null;
  private initData: GameInitData | null = null;

  private constructor(client: Client, userId: string, conversationId: string) {
    this.client = client;
    this.userId = userId;
    this.conversationId = conversationId;
  }

  /**
   * Create a new GameClient instance for a specific game conversation.
   * Uses the shared webchat client/userId.
   */
  static async create(gameConversationId: string): Promise<GameClient> {
    console.log("[GameClient] Creating for conversation:", gameConversationId);

    const { client, userId } = await getWebchatClient();
    const instance = new GameClient(client, userId, gameConversationId);

    return instance;
  }

  /**
   * Initialize the game client and set up listeners.
   * Fetches initial data (messages, participants) from the API.
   */
  async init(): Promise<GameInitData> {
    console.log("[GameClient] Initializing...");

    // Fetch messages and participants in parallel
    const [messagesResponse, participantsResponse] = await Promise.all([
      this.client.listConversationMessages({ conversationId: this.conversationId }),
      this.client.listParticipants({ conversationId: this.conversationId }),
    ]);

    // Filter out game event messages from the message list
    const regularMessages: Message[] = [];
    for (const message of messagesResponse.messages) {
      if (message.payload.type === "text") {
        const text = (message.payload as { text: string }).text;
        const gameEvent = parseGameEvent(text);
        if (gameEvent) {
          // Skip game event messages
          continue;
        }
      }
      regularMessages.push(message);
    }

    const initData: GameInitData = {
      conversationId: this.conversationId,
      messages: regularMessages,
      participants: participantsResponse.participants,
      userId: this.userId,
    };

    this.initData = initData;

    console.log("[GameClient] Fetched initial data:", {
      conversationId: initData.conversationId,
      messageCount: initData.messages.length,
      participantCount: initData.participants.length,
      participantIds: initData.participants.map((p) => p.id),
    });

    // Set up listener for future events
    this.setupListener();

    return initData;
  }

  /**
   * Fetch the current list of participants from the API
   */
  private async fetchParticipants(): Promise<Participant[]> {
    const response = await this.client.listParticipants({
      conversationId: this.conversationId,
    });
    return response.participants;
  }

  private setupListener(): void {
    console.log("[GameClient] Setting up conversation listener for:", this.conversationId);

    const listener = this.client.listenConversation({
      conversationId: this.conversationId,
    });

    const offMessage = listener("message_created", async (event) => {
      const message = event as Message;
      console.log("[GameClient] Message received:", message);

      // Check if this is a game event from the bot
      if (message.payload.type === "text") {
        const text = (message.payload as { text: string }).text;
        const gameEvent = parseGameEvent(text);

        if (gameEvent) {
          console.log("[GameClient] Game event received:", gameEvent.type, gameEvent.userId);

          // Refetch participants from the API to get the accurate list
          try {
            const participants = await this.fetchParticipants();
            console.log("[GameClient] Refetched participants:", participants.map((p) => p.id));
            this.participantsChangedHandlers.forEach((handler) => handler(participants, gameEvent));
          } catch (error) {
            console.error("[GameClient] Failed to fetch participants:", error);
          }

          // Don't forward game events to regular message handlers
          return;
        }
      }

      // Forward non-game-event messages to handlers
      this.messageHandlers.forEach((handler) => handler(message));
    });

    // Store cleanup function
    this.listenerCleanup = () => {
      offMessage();
      this.messageHandlers.clear();
      this.participantsChangedHandlers.clear();
    };

    console.log("[GameClient] Listener set up");
  }

  /**
   * Subscribe to new messages in the game conversation
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to participant list changes.
   * Called with the full updated participant list whenever it changes.
   */
  onParticipantsChanged(handler: ParticipantsChangedHandler): () => void {
    this.participantsChangedHandlers.add(handler);
    return () => this.participantsChangedHandlers.delete(handler);
  }

  /**
   * Send a message to the game conversation
   */
  async sendMessage(text: string): Promise<void> {
    await this.client.createMessage({
      conversationId: this.conversationId,
      metadata: {},
      payload: {
        type: "text",
        text,
      },
    });
  }

  /**
   * Get the game conversation ID
   */
  getConversationId(): string {
    return this.conversationId;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string {
    return this.userId;
  }

  /**
   * Get the initial data (after init() is called)
   */
  getInitData(): GameInitData | null {
    return this.initData;
  }

  /**
   * Leave the game by asking the bot to remove us as participant
   */
  async leaveGame(): Promise<void> {
    console.log("[GameClient] Leaving game via LobbyClient...", {
      conversationId: this.conversationId,
      userId: this.userId,
    });

    try {
      const lobbyClient = await LobbyClient.getInstance();
      await lobbyClient.leaveGame(this.conversationId);
      console.log("[GameClient] Successfully left game");
    } catch (error) {
      console.error("[GameClient] Failed to leave game:", error);
      throw error;
    }
  }

  /**
   * Clean up listeners and resources
   */
  destroy(): void {
    console.log("[GameClient] Destroying...");
    this.listenerCleanup?.();
    this.listenerCleanup = null;
    this.initData = null;
  }
}

export { GameClient };
