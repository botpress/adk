import { CLIENT_ID } from "@/config/constants";
import { createClient, createUser, type Client } from "@botpress/webchat-client";

type WebchatCredentials = {
  userId: string;
  token: string;
  client: Client;
};

let cachedCredentials: WebchatCredentials | null = null;
let initPromise: Promise<WebchatCredentials> | null = null;

/**
 * Get or create the shared webchat client and user.
 * This ensures the same client/userId is used across LobbyClient and GameClient.
 */
export async function getWebchatClient(): Promise<WebchatCredentials> {
  if (cachedCredentials) {
    return cachedCredentials;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = initializeWebchatClient();

  try {
    cachedCredentials = await initPromise;
    return cachedCredentials;
  } finally {
    initPromise = null;
  }
}

async function initializeWebchatClient(): Promise<WebchatCredentials> {
  console.log("[Webchat] Initializing shared client...");

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

  console.log("[Webchat] Shared client ready, userId:", creds.userId);

  return { userId: creds.userId, token: creds.token, client };
}

/**
 * Clear cached credentials (useful for logout/reset)
 */
export function clearWebchatClient(): void {
  cachedCredentials = null;
}
