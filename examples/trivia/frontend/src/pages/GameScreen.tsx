import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { GameClient, LobbyClient, type GameInitData } from "@/lib";
import { type Message, type ListParticipantsResponse } from "@botpress/webchat-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowLeft } from "lucide-react";

type Participant = ListParticipantsResponse["participants"][number];

type GameState = "loading" | "waiting" | "playing" | "finished" | "error";

export function GameScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conversationId = searchParams.get("conversationId");
  const joinCode = searchParams.get("joinCode");

  const [gameState, setGameState] = useState<GameState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [initData, setInitData] = useState<GameInitData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  const gameClientRef = useRef<GameClient | null>(null);
  const hasInitialized = useRef(false);

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
        setMessages(data.messages);
        setGameState("waiting");

        // Subscribe to real-time updates
        gameClient.onMessage((message) => {
          console.log("[GameScreen] 📨 New message:", message);
          setMessages((prev) => [...prev, message]);
        });

        gameClient.onParticipantsChanged((newParticipants) => {
          console.log("[GameScreen] 👥 Participants changed:", newParticipants.map(p => p.id));
          setParticipants(newParticipants);
        });

        // Subscribe to removed_from_game notifications via LobbyClient
        const lobbyClient = await LobbyClient.getInstance();
        (globalThis as any).lobbyClient = lobbyClient;
        const unsubscribeRemoved = lobbyClient.onRemovedFromGame((notification) => {
          console.log("[GameScreen] 🔴 Received removed_from_game notification:", notification);
          if (notification.gameConversationId === conversationId) {
            console.log("[GameScreen] We were removed from this game, navigating away");
            gameClient.destroy();
            navigate("/");
          }
        });

        // Store cleanup for removed_from_game subscription
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
    <main className="min-h-screen p-4 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button onClick={handleLeaveGame} variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
            Leave Game
          </Button>
          {joinCode && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="text-sm text-blue-600 dark:text-blue-400">
                Join Code:
              </span>
              <span className="font-mono font-bold text-blue-700 dark:text-blue-300">
                {joinCode}
              </span>
            </div>
          )}
        </div>

        {/* Game Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Trivia Quiz
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {gameState === "waiting" && "Waiting for players..."}
            {gameState === "playing" && "Game in progress"}
            {gameState === "finished" && "Game finished!"}
          </p>
        </div>

        {/* Participants */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Players ({participants.length})
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {participants.map((participant) => {
              const isYou = participant.id === initData?.userId;
              const displayName = participant.name || "Anonymous";
              const initial = displayName.slice(0, 1).toUpperCase();

              return (
                <div
                  key={participant.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    isYou
                      ? "bg-blue-100 dark:bg-blue-900/30 ring-2 ring-blue-500"
                      : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {initial}
                  </div>
                  <span className="text-gray-900 dark:text-white">
                    {displayName}
                    {isYou && <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">(you)</span>}
                  </span>
                </div>
              );
            })}
            {participants.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400">
                No players yet...
              </p>
            )}
          </div>
        </Card>

        {/* Debug: Messages */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Messages ({messages.length})
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"
              >
                <div className="text-xs text-gray-500 mb-1">
                  {message.userId === initData?.userId ? "You" : "Bot"} -{" "}
                  {message.payload.type}
                </div>
                <pre className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap break-words">
                  {JSON.stringify(message.payload, null, 2)}
                </pre>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400">
                No messages yet...
              </p>
            )}
          </div>
        </Card>

        {/* Debug Info */}
        <Card className="p-6 bg-gray-100 dark:bg-gray-900">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
            Debug Info
          </h2>
          <div className="text-xs font-mono text-gray-600 dark:text-gray-500 space-y-1">
            <p>Conversation ID: {conversationId}</p>
            <p>User ID: {initData?.userId}</p>
            <p>State: {gameState}</p>
          </div>
        </Card>
      </div>
    </main>
  );
}
