import { Message } from "@botpress/client";
import { context } from "@botpress/runtime";
import { BrandProgressData, ExtractionSteps } from "./brand-types";

// Re-export types for convenience
export * from "./brand-types";

export async function createBrandProgressComponent(
  initialData: BrandProgressData
): Promise<Message> {
  const { message } = await context.get("client").createMessage({
    conversationId: context.get("conversation").id,
    userId: context.get("botId"),
    type: "custom",
    payload: {
      name: "brand_progress",
      url: "custom://brand_progress",
      data: initialData,
    },
    tags: {},
  });

  return message;
}

function isStatusFinal(status: string) {
  return status === "done" || status === "errored" || status === "cancelled";
}

export async function updateBrandProgressComponent(
  messageId: string,
  data: Partial<BrandProgressData> & { companyName: string }
): Promise<Message> {
  const client = context.get("client");

  const msg = await client.getMessage({ id: messageId });
  const existingData = msg.message.payload?.data as
    | BrandProgressData
    | undefined;

  // Don't update if already in final state
  if (existingData && isStatusFinal(existingData.status)) {
    return msg.message;
  }

  // Merge steps: update only changed step states, ensuring status is always defined
  const mergedSteps: ExtractionSteps = {
    websiteSearch: {
      status: data.steps?.websiteSearch?.status ?? existingData?.steps?.websiteSearch?.status ?? "pending",
      error: data.steps?.websiteSearch?.error ?? existingData?.steps?.websiteSearch?.error,
      url: data.steps?.websiteSearch?.url ?? existingData?.steps?.websiteSearch?.url,
    },
    screenshot: {
      status: data.steps?.screenshot?.status ?? existingData?.steps?.screenshot?.status ?? "pending",
      error: data.steps?.screenshot?.error ?? existingData?.steps?.screenshot?.error,
      imageUrl: data.steps?.screenshot?.imageUrl ?? existingData?.steps?.screenshot?.imageUrl,
    },
    logoExtraction: {
      status: data.steps?.logoExtraction?.status ?? existingData?.steps?.logoExtraction?.status ?? "pending",
      error: data.steps?.logoExtraction?.error ?? existingData?.steps?.logoExtraction?.error,
      logoUrl: data.steps?.logoExtraction?.logoUrl ?? existingData?.steps?.logoExtraction?.logoUrl,
    },
    colorExtraction: {
      status: data.steps?.colorExtraction?.status ?? existingData?.steps?.colorExtraction?.status ?? "pending",
      error: data.steps?.colorExtraction?.error ?? existingData?.steps?.colorExtraction?.error,
    },
  };

  // Merge the data
  const mergedData: BrandProgressData = {
    status: data.status || existingData?.status || "in_progress",
    companyName: data.companyName,
    websiteUrl: data.websiteUrl || existingData?.websiteUrl,
    steps: mergedSteps,
    brandData: data.brandData || existingData?.brandData,
    error: data.error || existingData?.error,
  };

  const { message } = await client.updateMessage({
    id: messageId,
    payload: {
      name: "brand_progress",
      url: "custom://brand_progress",
      data: mergedData,
    },
    tags: {},
  });

  return message;
}

// Helper to update a single step
export async function updateStep(
  messageId: string,
  companyName: string,
  stepName: keyof ExtractionSteps,
  stepData: ExtractionSteps[typeof stepName]
): Promise<Message> {
  return updateBrandProgressComponent(messageId, {
    companyName,
    steps: {
      websiteSearch: { status: "pending" },
      screenshot: { status: "pending" },
      logoExtraction: { status: "pending" },
      colorExtraction: { status: "pending" },
      [stepName]: stepData,
    },
  });
}
