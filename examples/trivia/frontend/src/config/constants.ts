export const BOT_CONFIG = {
  name: "Trivia Quiz",
  avatar: "", // Optional: Add your bot avatar URL
  description: "Multiplayer trivia quiz game - create or join games!",
} as const;

// Get this from your Botpress workspace after running `adk deploy`
// Go to: Botpress Dashboard > Your Bot > Webchat > Client ID
// Set VITE_CLIENT_ID in your .env file or Vercel environment variables
export const CLIENT_ID = import.meta.env.VITE_CLIENT_ID as string;
