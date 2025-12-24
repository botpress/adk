import { context } from "@botpress/runtime";

type Client = ReturnType<typeof context.getAll>["client"];

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generate a random 6-character alphanumeric join code
 */
export function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

/**
 * Check if a join code is unique (not used by any active game conversation)
 */
async function isJoinCodeUnique(
  code: string,
  client: Client
): Promise<boolean> {
  const { conversations } = await client.listConversations({
    tags: {
      code,
      status: "waiting",
      type: "game",
    },
  });
  return conversations.length === 0;
}

/**
 * Generate a unique join code (retries if collision)
 */
export async function generateUniqueJoinCode(client: Client): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const code = generateJoinCode();
    if (await isJoinCodeUnique(code, client)) {
      return code;
    }
    attempts++;
  }
  throw new Error("Failed to generate unique join code after 10 attempts");
}
