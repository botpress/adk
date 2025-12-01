export const BOT_CONFIG = {
  name: "Subagents Assistant",
  avatar: "", // Optional: Add your bot avatar URL
  description: "A multi-agent AI assistant powered by Botpress ADK.",
} as const;

// Get this from your Botpress workspace after running `adk deploy`
// Go to: Botpress Dashboard > Your Bot > Webchat > Client ID
export const CLIENT_ID = "<YOUR_WEBCHAT_CLIENT_ID>" as const;
