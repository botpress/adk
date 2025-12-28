import { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { GameClient, LobbyClient, type GameInitData } from "@/lib";
import { type ListParticipantsResponse } from "@botpress/webchat-client";
import {
  parseGameEvent,
  type QuestionStartEvent,
  type QuestionScoresEvent,
  type GameScoresEvent,
} from "@/types/lobby-messages";
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
  QUESTION_COUNT_OPTIONS,
  TIMER_OPTIONS,
} from "@/types/game-settings";
import { LanguageSelect } from "@/components/ui/language-select";
import { NumberSelect } from "@/components/ui/number-select";

const SETTINGS_STORAGE_KEY = "trivia-game-settings";
import { Composer } from "@botpress/webchat";
import "@botpress/webchat/style.css";
import QuestionCard from "@/components/trivia/QuestionCard";
import ScoreCard from "@/components/trivia/ScoreCard";
import LeaderboardCard from "@/components/trivia/LeaderboardCard";
import "@/components/trivia/trivia.css";

type Participant = ListParticipantsResponse["participants"][number];

type GameState = "loading" | "waiting" | "playing" | "ended" | "cancelled" | "error";

// What the player is currently seeing during gameplay
type PlayState = "waiting_for_question" | "answering" | "viewing_scores" | "viewing_leaderboard";

// Helper to build leaderboard from scores (using cumulative scores)
function buildLeaderboard(scores: QuestionScoresEvent["scores"]): { rank: number; username: string; score: number }[] {
  // Sort by cumulative score descending, then assign ranks
  const sorted = [...scores].sort((a, b) => b.cumulativeScore - a.cumulativeScore);
  let currentRank = 1;
  let previousScore = -1;

  return sorted.map((s, index) => {
    if (s.cumulativeScore !== previousScore) {
      currentRank = index + 1;
    }
    previousScore = s.cumulativeScore;
    return {
      rank: currentRank,
      username: s.username,
      score: s.cumulativeScore,
    };
  });
}

type ChatMessage = {
  id: string;
  text: string;
  authorId?: string;
  timestamp: Date;
  isSystem?: boolean;
  variant?: "success" | "error" | "game-results";
  gameResults?: {
    winner: string;
    isTie: boolean;
    tiedPlayers: string[];
    leaderboard: Array<{ rank: number; username: string; score: number }>;
  };
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

  // Load saved settings from localStorage
  const getSavedSettings = (): GameSettings => {
    try {
      const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_GAME_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Failed to load saved settings:", e);
    }
    return DEFAULT_GAME_SETTINGS;
  };

  const [settings, setSettings] = useState<GameSettings>(getSavedSettings);
  const [localSettings, setLocalSettings] = useState<GameSettings>(getSavedSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Gameplay state
  const [playState, setPlayState] = useState<PlayState>("waiting_for_question");
  const [currentQuestion, setCurrentQuestion] = useState<QuestionStartEvent | null>(null);
  const [currentScores, setCurrentScores] = useState<QuestionScoresEvent | null>(null);
  const [finalLeaderboard, setFinalLeaderboard] = useState<GameScoresEvent | null>(null);

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
        setGameState(data.status);

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
              // Show game_started as a system message
              if (gameEvent.type === "game_started") {
                initialMessages.push({
                  id: message.id,
                  text: "Game started!",
                  timestamp: new Date(message.createdAt),
                  isSystem: true,
                });
              } else if (gameEvent.type === "game_cancelled") {
                initialMessages.push({
                  id: message.id,
                  text: "Host left. Game cancelled.",
                  timestamp: new Date(message.createdAt),
                  isSystem: true,
                  variant: "error",
                });
              } else if (gameEvent.type === "game_ended") {
                // Show game_ended as a rich results card
                // Check for tie - find all players with rank 1
                const topPlayers = gameEvent.leaderboard.filter(e => e.rank === 1);
                const isTie = topPlayers.length > 1;
                const tiedPlayers = topPlayers.map(e => e.username);
                const winner = topPlayers[0]?.username || "Unknown";

                initialMessages.push({
                  id: message.id,
                  text: "Game Over",
                  timestamp: new Date(message.createdAt),
                  isSystem: true,
                  variant: "game-results",
                  gameResults: {
                    winner,
                    isTie,
                    tiedPlayers,
                    leaderboard: gameEvent.leaderboard.map(e => ({
                      rank: e.rank,
                      username: e.username,
                      score: e.score,
                    })),
                  },
                });
              }
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

        // Subscribe to game started event
        gameClient.onGameStarted(() => {
          console.log("[GameScreen] Game started!");
          setGameState("playing");
          setMessages((prev) => [
            ...prev,
            {
              id: `game-started-${Date.now()}`,
              text: "Game started!",
              timestamp: new Date(),
              isSystem: true,
            },
          ]);
        });

        // Subscribe to game cancelled event (host left)
        gameClient.onGameCancelled(() => {
          console.log("[GameScreen] Game cancelled!");
          setGameState("cancelled");
          setMessages((prev) => [
            ...prev,
            {
              id: `game-cancelled-${Date.now()}`,
              text: "Host left. Game cancelled.",
              timestamp: new Date(),
              isSystem: true,
              variant: "error",
            },
          ]);
        });

        // Subscribe to question start events (from workflow)
        gameClient.onQuestionStart((event) => {
          console.log("[GameScreen] Question start:", event.questionIndex);
          setPlayState("answering");
          setCurrentQuestion(event);
          setCurrentScores(null);
        });

        // Subscribe to question scores events (from workflow)
        gameClient.onQuestionScores((event) => {
          console.log("[GameScreen] Question scores:", event.questionIndex);
          setPlayState("viewing_scores");
          setCurrentScores(event);
          setCurrentQuestion(null);
        });

        // Subscribe to game scores events (from workflow - final leaderboard)
        gameClient.onGameScores((event) => {
          console.log("[GameScreen] Game scores (final)");
          setPlayState("viewing_leaderboard");
          setFinalLeaderboard(event);
          setCurrentQuestion(null);
          setCurrentScores(null);
          setGameState("ended");
        });

        // Subscribe to game ended events (from workflow - game complete, back to waiting)
        gameClient.onGameEnded((event) => {
          console.log("[GameScreen] Game ended, returning to waiting");
          // Add final scores as a rich game results message
          // Check for tie - find all players with rank 1
          const topPlayers = event.leaderboard.filter(e => e.rank === 1);
          const isTie = topPlayers.length > 1;
          const tiedPlayers = topPlayers.map(e => e.username);
          const winner = topPlayers[0]?.username || "Unknown";

          setMessages((prev) => [
            ...prev,
            {
              id: `game-ended-${Date.now()}`,
              text: "Game Over",
              timestamp: new Date(),
              isSystem: true,
              variant: "game-results",
              gameResults: {
                winner,
                isTie,
                tiedPlayers,
                leaderboard: event.leaderboard.map(e => ({
                  rank: e.rank,
                  username: e.username,
                  score: e.score,
                })),
              },
            },
          ]);
          // Reset to waiting state
          setPlayState("waiting_for_question");
          setFinalLeaderboard(null);
          setCurrentQuestion(null);
          setCurrentScores(null);
          setGameState("waiting");
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

  const handleStartGame = async () => {
    if (!gameClientRef.current) return;

    try {
      console.log("[GameScreen] Starting game with settings:", settings);
      setGameState("playing");
      await gameClientRef.current.startGame();
    } catch (err) {
      console.error("[GameScreen] Failed to start game:", err);
      setGameState("waiting");
      setError(
        err instanceof Error ? err.message : "Failed to start game"
      );
    }
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
        // Save to localStorage for next game
        try {
          localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(localSettings));
        } catch (e) {
          console.warn("Failed to save settings:", e);
        }
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
              onClick={gameState === "cancelled" ? () => navigate("/") : handleLeaveGame}
              className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">{gameState === "cancelled" ? "Back" : "Leave"}</span>
            </button>

            {/* Game Status / Join Code */}
            {gameState === "waiting" && joinCode ? (
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
            ) : gameState === "playing" ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-medium text-green-700 dark:text-green-300">
                  In progress
                </span>
              </div>
            ) : gameState === "cancelled" ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="font-medium text-red-700 dark:text-red-300">
                  Cancelled
                </span>
              </div>
            ) : null}

            {/* Settings / Players count */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Users className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {participants.length}
                </span>
              </div>
              {isCreator && gameState === "waiting" && (
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
                      {/* Language */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Language
                        </label>
                        <LanguageSelect
                          value={localSettings.language}
                          onChange={(language) =>
                            handleSettingsChange({
                              ...localSettings,
                              language,
                            })
                          }
                        />
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

                      {/* Question Count & Timer Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Questions
                          </label>
                          <NumberSelect
                            value={localSettings.questionCount}
                            onChange={(questionCount) =>
                              handleSettingsChange({
                                ...localSettings,
                                questionCount,
                              })
                            }
                            options={QUESTION_COUNT_OPTIONS}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Timer
                          </label>
                          <NumberSelect
                            value={localSettings.timerSeconds}
                            onChange={(timerSeconds) =>
                              handleSettingsChange({
                                ...localSettings,
                                timerSeconds,
                              })
                            }
                            options={TIMER_OPTIONS}
                          />
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
            {settings.language && settings.language !== "english" && (
              <>
                <span>·</span>
                <span className="capitalize">{settings.language}</span>
              </>
            )}
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

        {/* Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Gameplay UI - Question/Scores/Leaderboard */}
          {gameState === "playing" && currentQuestion && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <QuestionCard
                data={{
                  gameId: 0,
                  questionIndex: currentQuestion.questionIndex,
                  totalQuestions: currentQuestion.totalQuestions,
                  question: currentQuestion.question,
                  questionType: currentQuestion.questionType,
                  options: currentQuestion.options,
                  category: currentQuestion.category,
                  difficulty: currentQuestion.difficulty,
                  timerSeconds: currentQuestion.timerSeconds,
                  delegate: currentQuestion.delegates[initData?.userId || ""] || {
                    id: "",
                    ack_url: "",
                    fulfill_url: "",
                    reject_url: "",
                  },
                }}
              />
            </div>
          )}

          {gameState === "playing" && currentScores && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <ScoreCard
                data={{
                  gameId: 0,
                  questionIndex: currentScores.questionIndex,
                  totalQuestions: currentScores.totalQuestions,
                  correctAnswer: currentScores.correctAnswer,
                  yourAnswer: currentScores.scores.find(s => s.visibleUserId === initData?.userId)?.answer,
                  yourPoints: currentScores.scores.find(s => s.visibleUserId === initData?.userId)?.points || 0,
                  isCorrect: currentScores.scores.find(s => s.visibleUserId === initData?.userId)?.isCorrect || false,
                  leaderboard: buildLeaderboard(currentScores.scores),
                  isLastQuestion: currentScores.questionIndex === currentScores.totalQuestions - 1,
                  isCreator: isCreator || false,
                }}
              />
            </div>
          )}

          {(gameState === "ended" || playState === "viewing_leaderboard") && finalLeaderboard && (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <LeaderboardCard
                data={{
                  gameId: 0,
                  leaderboard: finalLeaderboard.leaderboard.map(e => ({
                    rank: e.rank,
                    username: e.username,
                    score: e.score,
                  })),
                  isCreator: isCreator || false,
                  onClose: isCreator ? async () => {
                    await gameClientRef.current?.closeGame();
                  } : undefined,
                }}
              />
            </div>
          )}

          {/* Messages (show in waiting state or when no gameplay UI) */}
          <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-3 ${gameState === "playing" && (currentQuestion || currentScores) ? "hidden" : ""} ${gameState === "ended" ? "hidden" : ""}`}>
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 py-8">
                No messages yet. Say hello!
              </div>
            ) : (
              messages.map((msg) => {
                if (msg.isSystem) {
                  // Game results card
                  if (msg.variant === "game-results" && msg.gameResults) {
                    const getMedal = (rank: number) => {
                      if (rank === 1) return "🥇";
                      if (rank === 2) return "🥈";
                      if (rank === 3) return "🥉";
                      return `#${rank}`;
                    };

                    // Format the winner text based on tie status
                    const getWinnerText = () => {
                      if (!msg.gameResults) return "";
                      if (msg.gameResults.isTie) {
                        const players = msg.gameResults.tiedPlayers;
                        if (players.length === 2) {
                          return `${players[0]} & ${players[1]} tie!`;
                        }
                        // 3+ way tie
                        const lastPlayer = players[players.length - 1];
                        const otherPlayers = players.slice(0, -1).join(", ");
                        return `${otherPlayers} & ${lastPlayer} tie!`;
                      }
                      return `${msg.gameResults.winner} wins!`;
                    };

                    return (
                      <div key={msg.id} className="flex justify-center my-4">
                        <div className="w-full max-w-sm bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20 rounded-2xl p-4 shadow-lg border border-amber-200 dark:border-amber-800">
                          <div className="text-center mb-3">
                            <div className="text-3xl mb-1">🏆</div>
                            <div className="text-lg font-bold text-amber-800 dark:text-amber-200">
                              Game Over
                            </div>
                            <div className="text-sm text-amber-600 dark:text-amber-400">
                              {getWinnerText()}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            {msg.gameResults.leaderboard.slice(0, 5).map((entry) => (
                              <div
                                key={entry.username}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                                  entry.rank === 1
                                    ? "bg-amber-200/50 dark:bg-amber-700/30"
                                    : "bg-white/50 dark:bg-gray-800/50"
                                }`}
                              >
                                <span className="w-6 text-center">{getMedal(entry.rank)}</span>
                                <span className="flex-1 font-medium text-gray-800 dark:text-gray-200 truncate">
                                  {entry.username}
                                </span>
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                  {entry.score}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Regular system message
                  const isError = msg.variant === "error";
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
                          isError
                            ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                            : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isError ? "bg-red-500" : "bg-green-500"
                          }`}
                        />
                        <span className="font-medium">{msg.text}</span>
                      </div>
                    </div>
                  );
                }

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
            {gameState === "waiting" && (
              <>
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
              </>
            )}

            {gameState === "playing" && playState === "waiting_for_question" && (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-gray-500 dark:text-gray-400">Waiting for question...</p>
              </div>
            )}

            {gameState === "cancelled" && (
              <Button
                size="lg"
                variant="default"
                className="w-full"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
