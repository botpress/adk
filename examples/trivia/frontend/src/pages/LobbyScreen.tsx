import { useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLobby } from "@/hooks/useLobby";

export function LobbyScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const joinCode = searchParams.get("join");
  const action = searchParams.get("action");

  const { client, isLoading, error } = useLobby();
  const hasStartedAction = useRef(false);

  useEffect(() => {
    if (isLoading || !client || hasStartedAction.current) {
      return;
    }

    // No action specified
    if (!joinCode && action !== "create") {
      console.log("[Lobby] No action specified, redirecting to home");
      navigate("/");
      return;
    }

    hasStartedAction.current = true;

    const performAction = async () => {
      try {
        if (joinCode) {
          console.log("[Lobby] Joining game with code:", joinCode);
          const { conversationId } = await client.joinGame(joinCode);
          console.log("[Lobby] Join successful! Navigating to game:", conversationId);
          navigate(`/chat?conversationId=${conversationId}`);
        } else if (action === "create") {
          console.log("[Lobby] Creating new game");
          const { conversationId, joinCode: newCode } = await client.createGame();
          console.log("[Lobby] Game created! Join code:", newCode);
          navigate(`/chat?conversationId=${conversationId}`);
        }
      } catch (err) {
        console.error("[Lobby] Action failed:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        navigate(`/?error=${encodeURIComponent(message)}`);
      }
    };

    performAction();
  }, [client, isLoading, joinCode, action, navigate]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">Error: {error.message}</p>
          <button
            onClick={() => navigate("/")}
            className="text-blue-500 underline"
          >
            Go back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-600 dark:text-gray-400 text-lg">
          {isLoading
            ? "Connecting..."
            : joinCode
              ? `Joining game ${joinCode}...`
              : "Creating game..."}
        </p>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          Check console for debug messages
        </p>
      </div>
    </main>
  );
}
