import { context } from "@botpress/runtime";

/**
 * Checks whether the conversation contains any user-uploaded images.
 * The conversation handler uses this to switch to a vision-capable model
 * (e.g. gpt-5-mini) instead of the default text-only model.
 */
export async function transcriptHasImages() {
  const transcript = await context.get("chat").getTranscript();
  const hasImages = transcript.some(
    (message) =>
      message.role === "user" &&
      message.attachments?.some((x) => x.type === "image")
  );
  return hasImages;
}
