import { useEffect, useState } from "react";
import { LobbyClient } from "@/lib/LobbyClient";

export function useLobby() {
  const [client, setClient] = useState<LobbyClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    LobbyClient.getInstance()
      .then((instance) => {
        if (!cancelled) {
          setClient(instance);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { client, isLoading, error };
}
