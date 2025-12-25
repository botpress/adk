import { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
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
import { Users, ArrowLeft, Settings, Copy, Check, Crown } from "lucide-react";
import {
  type GameSettings,
  DEFAULT_GAME_SETTINGS,
  DIFFICULTY_OPTIONS,
  SCORE_METHOD_OPTIONS,
  CATEGORY_OPTIONS,
} from "@/types/game-settings";
import { Composer } from "@botpress/webchat";
import "@botpress/webchat/style.css";

type Participant = ListParticipantsResponse["participants"][number];

type GameState = "loading" | "waiting" | "playing" | "finished" | "error";

type ChatMessage = {
  id: string;
  text: string;
  authorId?: string;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [localSettings, setLocalSettings] = useState<GameSettings>(
    DEFAULT_GAME_SETTINGS
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const gameClientRef = useRef<GameClient | null>(null);
  const hasInitialized = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCreator = initData?.userId === initData?.creatorUserId;
  const canStartGame = participants.length >= 2;

  // Create a map of participant IDs to names for message display
  const participantNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of participants) {
      map.set(p.id, p.name || "Anonymous");
    }
    return map;
  }, [participants]);

  // Scroll to bottom when new messages arrive
  useLayoutEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        console.log(
          "[GameScreen] Initializing game client for:",
          conversationId
        );

        const gameClient = await GameClient.create(conversationId);
        gameClientRef.current = gameClient;
        (globalThis as any).gameClient = gameClient;

        const data = await gameClient.init();
        setInitData(data);
        setParticipants(data.participants);
        if (data.settings) {
          setSettings(data.settings);
        }
        setGameState("waiting");

        // Find creator from initial messages by looking for participant_added with isCreator: true
        const { getWebchatClient } = await import("@/lib/webchat");
        const webchat = await getWebchatClient();
        const messagesResponse = await webchat.client.listConversationMessages({
          conversationId: conversationId!,
        });

        const initialMessages: ChatMessage[] = [];

        for (const message of messagesResponse.messages) {
          if (message.payload.type === "text") {
            const text = (message.payload as { text: string }).text;
            const gameEvent = parseGameEvent(text);
            if (gameEvent) {
              // Skip game event messages - they're not regular chat
            } else {
              // Regular text message
              initialMessages.push({
                id: message.id,
                text,
                authorId: message.userId,
                timestamp: new Date(message.createdAt),
              });
            }
          }
        }

        // Sort by timestamp (oldest first)
        initialMessages.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        setMessages(initialMessages);

        // Subscribe to real-time updates
        gameClient.onMessage((message) => {
          console.log("[GameScreen] New message:", message);
          if (message.payload.type === "text") {
            const text = (message.payload as { text: string }).text;
            // Skip JSON messages (system events)
            if (!text.startsWith("{")) {
              setMessages((prev) => [
                ...prev,
                {
                  id: message.id,
                  text,
                  authorId: message.userId,
                  timestamp: new Date(),
                },
              ]);
            }
          }
        });

        gameClient.onParticipantsChanged((newParticipants) =>
          setParticipants(newParticipants)
        );

        // Subscribe to settings changes (from creator)
        gameClient.onSettingsChanged((newSettings) => {
          console.log("[GameScreen] Settings changed:", newSettings);
          setSettings(newSettings);
        });

        // Subscribe to removed_from_game notifications via LobbyClient
        const lobbyClient = await LobbyClient.getInstance();
        const unsubscribeRemoved = lobbyClient.onRemovedFromGame(
          (notification) => {
            if (notification.gameConversationId === conversationId) {
              gameClient.destroy();
              navigate("/");
            }
          }
        );

        const originalCleanup = gameClient.destroy.bind(gameClient);
        gameClient.destroy = () => {
          unsubscribeRemoved();
          originalCleanup();
        };
      } catch (err) {
        console.error("[GameScreen] Failed to initialize:", err);
        setError(
          err instanceof Error ? err.message : "Failed to connect to game"
        );
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

  const handleSendMessage = async (payload: {
    type: string;
    text?: string;
  }) => {
    if (payload.type === "text" && payload.text && gameClientRef.current) {
      await gameClientRef.current.sendMessage(payload.text);
    }
  };

  const handleStartGame = () => {
    // TODO: Implement start game
    console.log("[GameScreen] Starting game with settings:", settings);
  };

  // Helper to update local settings (used while drawer is open)
  const handleSettingsChange = (newSettings: GameSettings) => {
    setLocalSettings(newSettings);
  };

  // Broadcast settings when drawer closes
  const handleSettingsDrawerChange = (open: boolean) => {
    if (!open && isSettingsOpen) {
      // Drawer is closing - broadcast settings if they changed
      if (JSON.stringify(localSettings) !== JSON.stringify(settings)) {
        setSettings(localSettings);
        gameClientRef.current?.updateSettings(localSettings);
      }
    } else if (open) {
      // Drawer is opening - sync local settings with current settings
      setLocalSettings(settings);
    }
    setIsSettingsOpen(open);
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
      <div className="flex-1 flex flex-col w-full max-w-[750px] mx-auto overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
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
                <span className="text-sm font-medium">
                  {participants.length}
                </span>
              </div>
              {isCreator && (
                <Drawer
                  open={isSettingsOpen}
                  onOpenChange={handleSettingsDrawerChange}
                >
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
                              onClick={() =>
                                handleSettingsChange({
                                  ...localSettings,
                                  difficulty: opt.value,
                                })
                              }
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                localSettings.difficulty === opt.value
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
                          Questions: {localSettings.questionCount}
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="30"
                          step="5"
                          value={localSettings.questionCount}
                          onChange={(e) =>
                            handleSettingsChange({
                              ...localSettings,
                              questionCount: parseInt(e.target.value),
                            })
                          }
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
                          Timer: {localSettings.timerSeconds}s
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="60"
                          step="5"
                          value={localSettings.timerSeconds}
                          onChange={(e) =>
                            handleSettingsChange({
                              ...localSettings,
                              timerSeconds: parseInt(e.target.value),
                            })
                          }
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
                              onClick={() =>
                                handleSettingsChange({
                                  ...localSettings,
                                  scoreMethod: opt.value,
                                })
                              }
                              className={`w-full px-4 py-3 rounded-lg text-left transition-colors ${
                                localSettings.scoreMethod === opt.value
                                  ? "bg-blue-500 text-white"
                                  : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                              }`}
                            >
                              <div className="font-medium">{opt.label}</div>
                              <div
                                className={`text-sm ${localSettings.scoreMethod === opt.value ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}
                              >
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
                              onClick={() =>
                                handleSettingsChange({
                                  ...localSettings,
                                  categories: [opt.value],
                                })
                              }
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                localSettings.categories.includes(opt.value)
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

          {/* Settings summary */}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
            <span className="capitalize">{settings.difficulty}</span>
            <span>·</span>
            <span>{settings.questionCount} questions</span>
            <span>·</span>
            <span>{settings.timerSeconds}s timer</span>
            <span>·</span>
            <span>
              {
                SCORE_METHOD_OPTIONS.find(
                  (o) => o.value === settings.scoreMethod
                )?.label
              }
            </span>
            <span>·</span>
            <span className="capitalize">
              {settings.categories[0] === "any"
                ? "Any category"
                : settings.categories[0]}
            </span>
          </div>
        </header>

        {/* Participants Bar */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
          <div className="flex gap-2">
            {participants.map((participant) => {
              const isYou = participant.id === initData?.userId;
              const isHost = participant.id === initData?.creatorUserId;
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
                    {isYou && (
                      <span className="text-xs text-gray-500 ml-1">(you)</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = msg.authorId === initData?.userId;
                const senderName = msg.authorId
                  ? participantNames.get(msg.authorId) || "Unknown"
                  : "System";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"}`}
                  >
                    {!isOwnMessage && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 mb-1 ml-1">
                        {senderName}
                      </span>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl wrap-break-word ${
                        isOwnMessage
                          ? "bg-blue-500 text-white rounded-br-md"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-md"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
            <Composer
              connected={true}
              sendMessage={handleSendMessage}
              composerPlaceholder="Type a message..."
            />

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
        </div>
      </div>
    </main>
  );
}
