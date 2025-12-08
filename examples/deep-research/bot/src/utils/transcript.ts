import { context } from "@botpress/runtime";

export async function transcriptHasImages() {
  const transcript = await context.get("chat").getTranscript();
  const hasImages = transcript.some(
    (message) =>
      message.role === "user" &&
      message.attachments?.some((x) => x.type === "image")
  );
  return hasImages;
}
