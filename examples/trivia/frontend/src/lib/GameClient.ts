import {
  type Client,
  type Message,
  type ListParticipantsResponse,
} from "@botpress/webchat-client";
import { getWebchatClient } from "./webchat";
import { LobbyClient } from "./LobbyClient";
import {
  parseGameEvent,
  type GameEvent,
  type QuestionStartEvent,
  type QuestionScoresEvent,
  type GameScoresEvent,
  type GameEndedEvent,
} from "@/types/lobby-messages";
import type { GameSettings } from "@/types/game-settings";

type Participant = ListParticipantsResponse["participants"][number];

type MessageHandler = (message: Message) => void;
type ParticipantsChangedHandler = (
  participants: Participant[],
  event?: GameEvent
) => void;
type SettingsChangedHandler = (settings: GameSettings) => void;
type GameStartedHandler = (settings: GameSettings) => void;
type GameCancelledHandler = () => void;
type QuestionStartHandler = (event: QuestionStartEvent) => void;
type QuestionScoresHandler = (event: QuestionScoresEvent) => void;
type GameScoresHandler = (event: GameScoresEvent) => void;
type GameEndedHandler = (event: GameEndedEvent) => void;

export type GameStatus = "waiting" | "playing" | "ended" | "cancelled";

export type GameInitData = {
  conversationId: string;
  messages: Message[];
  participants: Participant[];
  userId: string;
  settings: GameSettings | null;
  creatorUserId: string | null;
  status: GameStatus;
};

class GameClient {
  private client: Client;
  private userId: string;
  private conversationId: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private participantsChangedHandlers: Set<ParticipantsChangedHandler> =
    new Set();
  private settingsChangedHandlers: Set<SettingsChangedHandler> = new Set();
  private gameStartedHandlers: Set<GameStartedHandler> = new Set();
  private gameCancelledHandlers: Set<GameCancelledHandler> = new Set();
  private questionStartHandlers: Set<QuestionStartHandler> = new Set();
  private questionScoresHandlers: Set<QuestionScoresHandler> = new Set();
  private gameScoresHandlers: Set<GameScoresHandler> = new Set();
  private gameEndedHandlers: Set<GameEndedHandler> = new Set();
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

  private async fetchAllMessages(): Promise<Message[]> {
    let messagesNextToken: string | undefined = undefined;
    let allMessages: Message[] = [];

    do {
      const response = await this.client.listConversationMessages({
        conversationId: this.conversationId,
        nextToken: messagesNextToken,
      });
      allMessages = allMessages.concat(response.messages);
      messagesNextToken =
        response.messages.length > 1 ? response.meta.nextToken : undefined;
    } while (messagesNextToken);

    return allMessages.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  async fetchAllParticipants(): Promise<Participant[]> {
    let allParticipants: Participant[] = [];
    let nextToken: string | undefined = undefined;

    do {
      const response = await this.client.listParticipants({
        conversationId: this.conversationId,
        nextToken,
      });
      allParticipants = allParticipants.concat(response.participants);
      nextToken =
        response.participants.length > 1 ? response.meta.nextToken : undefined;
    } while (nextToken);

    return allParticipants;
  }

  /**
   * Initialize the game client and set up listeners.
   * Fetches initial data (messages, participants) from the API.
   */
  async init(): Promise<GameInitData> {
    console.log("[GameClient] Initializing...");

    // Fetch messages and participants in parallel
    const [sortedMessages, participants] = await Promise.all([
      this.fetchAllMessages(),
      this.fetchAllParticipants(),
    ]);

    console.log(
      "[GameClient] All messages (sorted oldest to newest):",
      sortedMessages
    );

    // Filter out game event messages and extract latest settings
    const regularMessages: Message[] = [];
    let latestSettings: GameSettings | null = null;
    let creatorUserId: string | null = null;
    let status: GameStatus = "waiting";

    for (const message of sortedMessages) {
      console.log(
        "[GameClient] Processing message:",
        message.createdAt,
        message.payload
      );
      if (message.payload.type === "text") {
        const text = (message.payload as { text: string }).text;
        const gameEvent = parseGameEvent(text);
        console.log("[GameClient] Parsed game event:", gameEvent);
        if (gameEvent) {
          // Extract settings from game_settings_updated events (last one wins)
          if (gameEvent.type === "game_settings_updated") {
            latestSettings = gameEvent.settings;
            console.log("[GameClient] Found settings:", latestSettings);
          } else if (gameEvent.type === "participant_added") {
            // Skip participant added events from regular messages
            if (gameEvent.isCreator) {
              creatorUserId = gameEvent.userId;
            }
          } else if (gameEvent.type === "game_started") {
            status = "playing";
            console.log("[GameClient] Found game_started event");
          } else if (gameEvent.type === "game_cancelled") {
            status = "cancelled";
            console.log("[GameClient] Found game_cancelled event");
          } else if (gameEvent.type === "game_ended") {
            status = "waiting";
            console.log("[GameClient] Found game_ended event, status back to waiting");
          }
          // Skip game event messages from regular messages
          continue;
        }
      }
      regularMessages.push(message);
    }

    console.log("[GameClient] Final status determined:", status);

    const initData: GameInitData = {
      conversationId: this.conversationId,
      messages: regularMessages,
      participants,
      userId: this.userId,
      settings: latestSettings,
      creatorUserId: creatorUserId,
      status,
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

  private setupListener(): void {
    console.log(
      "[GameClient] Setting up conversation listener for:",
      this.conversationId
    );

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
          console.log("[GameClient] Game event received:", gameEvent.type);

          // Handle settings updated event
          if (gameEvent.type === "game_settings_updated") {
            console.log("[GameClient] Settings updated:", gameEvent.settings);
            this.settingsChangedHandlers.forEach((handler) =>
              handler(gameEvent.settings)
            );
            // Don't forward to message handlers
            return;
          }

          // Handle game started event
          if (gameEvent.type === "game_started") {
            console.log("[GameClient] Game started with settings:", gameEvent.settings);
            this.gameStartedHandlers.forEach((handler) => handler(gameEvent.settings));
            // Don't forward to message handlers
            return;
          }

          // Handle game cancelled event
          if (gameEvent.type === "game_cancelled") {
            console.log("[GameClient] Game cancelled!");
            this.gameCancelledHandlers.forEach((handler) => handler());
            // Don't forward to message handlers
            return;
          }

          // Handle question start event (from workflow)
          if (gameEvent.type === "question_start") {
            console.log("[GameClient] Question start:", gameEvent.questionIndex);
            this.questionStartHandlers.forEach((handler) => handler(gameEvent));
            return;
          }

          // Handle question scores event (from workflow)
          if (gameEvent.type === "question_scores") {
            console.log("[GameClient] Question scores:", gameEvent.questionIndex);
            this.questionScoresHandlers.forEach((handler) => handler(gameEvent));
            return;
          }

          // Handle game scores event (from workflow)
          if (gameEvent.type === "game_scores") {
            console.log("[GameClient] Game scores (final leaderboard)");
            this.gameScoresHandlers.forEach((handler) => handler(gameEvent));
            return;
          }

          // Handle game ended event (from workflow - game is over, back to waiting)
          if (gameEvent.type === "game_ended") {
            console.log("[GameClient] Game ended, returning to waiting state");
            this.gameEndedHandlers.forEach((handler) => handler(gameEvent));
            return;
          }

          if (gameEvent.type === "participant_added") {
            // If the added participant is the creator, store their userId
            if (gameEvent.isCreator && this.initData) {
              this.initData.creatorUserId = gameEvent.userId;
            }
          }

          if (
            gameEvent.type === "participant_added" ||
            gameEvent.type === "participant_removed"
          ) {
            // Handle participant events - refetch participants from the API
            try {
              const participants = await this.fetchAllParticipants();
              console.log(
                "[GameClient] Refetched participants:",
                participants.map((p) => p.id)
              );
              this.participantsChangedHandlers.forEach((handler) =>
                handler(participants, gameEvent)
              );
            } catch (error) {
              console.error(
                "[GameClient] Failed to fetch participants:",
                error
              );
            }
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
      this.settingsChangedHandlers.clear();
      this.gameStartedHandlers.clear();
      this.gameCancelledHandlers.clear();
      this.questionStartHandlers.clear();
      this.questionScoresHandlers.clear();
      this.gameScoresHandlers.clear();
      this.gameEndedHandlers.clear();
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
   * Subscribe to game settings changes.
   * Called when the game creator updates settings.
   */
  onSettingsChanged(handler: SettingsChangedHandler): () => void {
    this.settingsChangedHandlers.add(handler);
    return () => this.settingsChangedHandlers.delete(handler);
  }

  /**
   * Subscribe to game started event.
   * Called when the game creator starts the game.
   */
  onGameStarted(handler: GameStartedHandler): () => void {
    this.gameStartedHandlers.add(handler);
    return () => this.gameStartedHandlers.delete(handler);
  }

  /**
   * Subscribe to game cancelled event.
   * Called when the game host leaves and cancels the game.
   */
  onGameCancelled(handler: GameCancelledHandler): () => void {
    this.gameCancelledHandlers.add(handler);
    return () => this.gameCancelledHandlers.delete(handler);
  }

  /**
   * Subscribe to question start event.
   * Called when the workflow starts a new question.
   */
  onQuestionStart(handler: QuestionStartHandler): () => void {
    this.questionStartHandlers.add(handler);
    return () => this.questionStartHandlers.delete(handler);
  }

  /**
   * Subscribe to question scores event.
   * Called when the workflow sends scores after a question.
   */
  onQuestionScores(handler: QuestionScoresHandler): () => void {
    this.questionScoresHandlers.add(handler);
    return () => this.questionScoresHandlers.delete(handler);
  }

  /**
   * Subscribe to game scores event.
   * Called when the workflow sends the final leaderboard.
   */
  onGameScores(handler: GameScoresHandler): () => void {
    this.gameScoresHandlers.add(handler);
    return () => this.gameScoresHandlers.delete(handler);
  }

  /**
   * Subscribe to game ended event.
   * Called when the workflow completes and the game returns to waiting state.
   */
  onGameEnded(handler: GameEndedHandler): () => void {
    this.gameEndedHandlers.add(handler);
    return () => this.gameEndedHandlers.delete(handler);
  }

  /**
   * Update game settings (creator only).
   * Sends the settings update as an event directly to the game conversation.
   */
  async updateSettings(settings: GameSettings): Promise<void> {
    console.log("[GameClient] Updating settings via event:", settings);

    await this.client.createEvent({
      conversationId: this.conversationId,
      payload: {
        type: "custom",
        data: {
          action: "update_settings",
          settings,
        },
      },
    });
  }

  /**
   * Start the game (creator only).
   * Sends the start_game request to the bot via event.
   */
  async startGame(): Promise<void> {
    console.log("[GameClient] Starting game");

    await this.client.createEvent({
      conversationId: this.conversationId,
      payload: {
        type: "custom",
        data: {
          action: "start_game",
        },
      },
    });
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
   * Close the game (after viewing final leaderboard).
   * Sends an event to the bot to mark the game as ended and return to waiting state.
   */
  async closeGame(): Promise<void> {
    console.log("[GameClient] Closing game (returning to waiting state)");

    await this.client.createEvent({
      conversationId: this.conversationId,
      payload: {
        type: "custom",
        data: {
          action: "close_game",
        },
      },
    });
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
