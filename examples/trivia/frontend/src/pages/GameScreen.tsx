import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { GameClient, LobbyClient, type GameInitData } from "@/lib";
import { type ListParticipantsResponse } from "@botpress/webchat-client";
import { parseGameEvent } from "@/types/lobby-messages";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Users,
  ArrowLeft,
  Settings,
  Copy,
  Check,
  Send,
  Crown,
} from "lucide-react";
import {
  type GameSettings,
  DEFAULT_GAME_SETTINGS,
  DIFFICULTY_OPTIONS,
  SCORE_METHOD_OPTIONS,
  CATEGORY_OPTIONS,
} from "@/types/game-settings";

type Participant = ListParticipantsResponse["participants"][number];

type GameState = "loading" | "waiting" | "playing" | "finished" | "error";

type ChatMessage = {
  id: string;
  type: "user" | "system";
  userId?: string;
  userName?: string;
  text: string;
  timestamp: Date;
};

export function GameScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get("conversationId");
  const joinCode = searchParams.get("joinCode");

  const [gameState, setGameState] = useState<GameState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [initData, setInitData] = useState<GameInitData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [creatorUserId, setCreatorUserId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const gameClientRef = useRef<GameClient | null>(null);
  const hasInitialized = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isCreator = initData?.userId === creatorUserId;
  const canStartGame = participants.length >= 2;

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (!conversationId) {
      navigate("/");
      return;
    }

    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const initGame = async () => {
      try {
        console.log("[GameScreen] Initializing game client for:", conversationId);

        const gameClient = await GameClient.create(conversationId);
        gameClientRef.current = gameClient;
        (globalThis as any).gameClient = gameClient;

        const data = await gameClient.init();
        setInitData(data);
        setParticipants(data.participants);
        setGameState("waiting");

        // Find creator from initial messages by looking for participant_added with isCreator: true
        // We need to fetch messages including game events to find the creator
        const { getWebchatClient } = await import("@/lib/webchat");
        const webchat = await getWebchatClient();
        const messagesResponse = await webchat.client.listConversationMessages({
          conversationId: conversationId!
        });

        let foundCreatorId: string | null = null;
        const initialChatMessages: ChatMessage[] = [
          {
            id: "welcome",
            type: "system",
            text: "Welcome to the game! Waiting for players to join...",
            timestamp: new Date(),
          },
        ];

        for (const message of messagesResponse.messages) {
          if (message.payload.type === "text") {
            const text = (message.payload as { text: string }).text;
            const gameEvent = parseGameEvent(text);
            if (gameEvent) {
              if (gameEvent.type === "participant_added" && gameEvent.isCreator) {
                foundCreatorId = gameEvent.userId;
              }
              // Add join/leave system messages for initial participants
              const participant = data.participants.find(p => p.id === gameEvent.userId);
              const name = participant?.name || "A player";
              initialChatMessages.push({
                id: message.id,
                type: "system",
                text: gameEvent.type === "participant_added"
                  ? `${name} joined the game`
                  : `${name} left the game`,
                timestamp: new Date(message.createdAt),
              });
            }
          }
        }

        setCreatorUserId(foundCreatorId);
        setChatMessages(initialChatMessages);

        // Subscribe to real-time updates
        gameClient.onMessage((message) => {
          console.log("[GameScreen] New message:", message);
          // Handle chat messages
          if (message.payload.type === "text") {
            const text = (message.payload as { text: string }).text;
            // Skip JSON messages (system events)
            if (!text.startsWith("{")) {
              const sender = data.participants.find(p => p.id === message.userId);
              setChatMessages((prev) => [
                ...prev,
                {
                  id: message.id,
                  type: "user",
                  userId: message.userId,
                  userName: sender?.name || "Anonymous",
                  text,
                  timestamp: new Date(),
                },
              ]);
            }
          }
        });

        gameClient.onParticipantsChanged((newParticipants, event) => {
          console.log("[GameScreen] Participants changed:", newParticipants.map(p => p.id));

          // Find added/removed participants for chat messages
          if (event) {
            // Track creator if this is the creator joining
            if (event.type === "participant_added" && event.isCreator) {
              setCreatorUserId(event.userId);
            }

            const participant = newParticipants.find(p => p.id === event.userId);
            const name = participant?.name || "A player";

            setChatMessages((prev) => [
              ...prev,
              {
                id: `${event.type}-${event.userId}-${Date.now()}`,
                type: "system",
                text: event.type === "participant_added"
                  ? `${name} joined the game`
                  : `${name} left the game`,
                timestamp: new Date(),
              },
            ]);
          }

          setParticipants(newParticipants);
        });

        // Subscribe to removed_from_game notifications via LobbyClient
        const lobbyClient = await LobbyClient.getInstance();
        const unsubscribeRemoved = lobbyClient.onRemovedFromGame((notification) => {
          if (notification.gameConversationId === conversationId) {
            gameClient.destroy();
            navigate("/");
          }
        });

        const originalCleanup = gameClient.destroy.bind(gameClient);
        gameClient.destroy = () => {
          unsubscribeRemoved();
          originalCleanup();
        };
      } catch (err) {
        console.error("[GameScreen] Failed to initialize:", err);
        setError(err instanceof Error ? err.message : "Failed to connect to game");
        setGameState("error");
      }
    };

    initGame();

    return () => {
      gameClientRef.current?.destroy();
    };
  }, [conversationId, navigate]);

  const handleLeaveGame = async () => {
    const gameClient = gameClientRef.current;
    if (gameClient) {
      try {
        await gameClient.leaveGame();
      } catch (err) {
        console.error("[GameScreen] Failed to leave game:", err);
      }
      gameClient.destroy();
    }
    navigate("/");
  };

  const handleCopyCode = async () => {
    if (joinCode) {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleSendChat = async () => {
    const text = chatInput.trim();
    if (!text || !gameClientRef.current) return;

    setChatInput("");
    await gameClientRef.current.sendMessage(text);
  };

  const handleStartGame = () => {
    // TODO: Implement start game
    console.log("[GameScreen] Starting game with settings:", settings);
  };

  if (gameState === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Connecting to game...
          </p>
        </div>
      </main>
    );
  }

  if (gameState === "error") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">Error: {error}</p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <button
            onClick={handleLeaveGame}
            className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">Leave</span>
          </button>

          {/* Join Code */}
          {joinCode && (
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-lg tracking-wider">
                {joinCode}
              </span>
              {codeCopied ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </button>
          )}

          {/* Settings / Players count */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Users className="w-4 h-4" />
              <span className="text-sm font-medium">{participants.length}</span>
            </div>
            {isCreator && (
              <Drawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DrawerTrigger asChild>
                  <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                    <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  </button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Game Settings</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-4 space-y-6 max-h-[60vh] overflow-y-auto">
                    {/* Difficulty */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Difficulty
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {DIFFICULTY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSettings({ ...settings, difficulty: opt.value })}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              settings.difficulty === opt.value
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Question Count */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Questions: {settings.questionCount}
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        step="5"
                        value={settings.questionCount}
                        onChange={(e) => setSettings({ ...settings, questionCount: parseInt(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>5</span>
                        <span>30</span>
                      </div>
                    </div>

                    {/* Timer */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Timer: {settings.timerSeconds}s
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="60"
                        step="5"
                        value={settings.timerSeconds}
                        onChange={(e) => setSettings({ ...settings, timerSeconds: parseInt(e.target.value) })}
                        className="w-full accent-blue-500"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>10s</span>
                        <span>60s</span>
                      </div>
                    </div>

                    {/* Score Method */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Scoring Method
                      </label>
                      <div className="space-y-2">
                        {SCORE_METHOD_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSettings({ ...settings, scoreMethod: opt.value })}
                            className={`w-full px-4 py-3 rounded-lg text-left transition-colors ${
                              settings.scoreMethod === opt.value
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className={`text-sm ${settings.scoreMethod === opt.value ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}>
                              {opt.description}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setSettings({ ...settings, categories: [opt.value] })}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              settings.categories.includes(opt.value)
                                ? "bg-blue-500 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DrawerFooter>
                    <DrawerClose asChild>
                      <Button>Done</Button>
                    </DrawerClose>
                  </DrawerFooter>
                </DrawerContent>
              </Drawer>
            )}
          </div>
        </div>

        {/* Settings summary for non-creator */}
        {!isCreator && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="capitalize">{settings.difficulty}</span>
            <span>·</span>
            <span>{settings.questionCount} questions</span>
            <span>·</span>
            <span>{settings.timerSeconds}s timer</span>
          </div>
        )}
      </header>

      {/* Participants Bar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        <div className="flex gap-2">
          {participants.map((participant) => {
            const isYou = participant.id === initData?.userId;
            const isHost = participant.id === creatorUserId;
            const displayName = participant.name || "Anonymous";
            const initial = displayName.slice(0, 1).toUpperCase();

            return (
              <div
                key={participant.id}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full ${
                  isYou
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                <div className="relative">
                  <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {initial}
                  </div>
                  {isHost && (
                    <Crown className="absolute -top-1 -right-1 w-3 h-3 text-yellow-500" />
                  )}
                </div>
                <span className="text-sm text-gray-900 dark:text-white whitespace-nowrap">
                  {displayName}
                  {isYou && <span className="text-xs text-gray-500 ml-1">(you)</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatMessages.map((msg) => (
          <div key={msg.id}>
            {msg.type === "system" ? (
              <div className="text-center">
                <span className="inline-block px-3 py-1 bg-gray-200 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-400">
                  {msg.text}
                </span>
              </div>
            ) : (
              <div className={`flex ${msg.userId === initData?.userId ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.userId === initData?.userId
                      ? "bg-blue-500 text-white rounded-br-md"
                      : "bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md"
                  }`}
                >
                  {msg.userId !== initData?.userId && (
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {msg.userName}
                    </div>
                  )}
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Bottom Action Area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
        {/* Chat Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSendChat}
            disabled={!chatInput.trim()}
            className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Start Game / Waiting */}
        {isCreator ? (
          <Button
            size="lg"
            className="w-full"
            onClick={handleStartGame}
            disabled={!canStartGame}
          >
            {canStartGame
              ? "Start Game"
              : `Need ${2 - participants.length} more player${2 - participants.length > 1 ? "s" : ""}`}
          </Button>
        ) : (
          <div className="text-center py-2 text-gray-500 dark:text-gray-400">
            Waiting for host to start the game...
          </div>
        )}
      </div>
    </main>
  );
}
