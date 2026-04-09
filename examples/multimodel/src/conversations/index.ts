/**
 * Multimodel Conversation Handler with Image Upload Support
 *
 * Handles text messages and image uploads, allowing users to switch between
 * different LLM models and interpret images using vision-capable models.
 */
import { Autonomous, Conversation, type Model, z } from "@botpress/runtime";
import { processFileMessage, isImageFile } from "../utils/file-upload";
import { isVisionCapable, getModelDisplayName } from "../utils/model-helpers";
import { FILE_CONFIG } from "../utils/constants";

export default new Conversation({
        channel: "*",
        state: z.object({
                currentModel: z.string().default("anthropic:claude-sonnet-4-5"),
                // Track uploaded images in conversation
                uploadedImages: z.array(
                        z.object({
                                fileId: z.string(),
                                fileName: z.string(),
                                fileUrl: z.string().optional(),
                                source: z.enum(["files-api", "webchat-reupload"]),
                                uploadedAt: z.string(),
                                interpretation: z.string().optional(), // Cache AI's interpretation
                        })
                ).default([]),
                lastImageId: z.string().optional(), // Quick reference to most recent
        }),
        
        handler: async ({ execute, message, conversation, state, client }) => {
                let models = ['auto', 'best', 'fast', 'anthropic:claude-3-5-haiku-20241022', 'anthropic:claude-3-7-sonnet-20250219', 'anthropic:claude-3-haiku-20240307', 'anthropic:claude-haiku-4-5-20251001', 'anthropic:claude-haiku-4-5-reasoning-20251001', 'anthropic:claude-sonnet-4-20250514', 'anthropic:claude-sonnet-4-5-20250929', 'cerebras:gpt-oss-120b', 'cerebras:llama-4-scout-17b-16e-instruct', 'cerebras:llama3.1-8b', 'cerebras:llama3.3-70b', 'cerebras:qwen-3-32b', 'fireworks-ai:deepseek-r1-0528', 'fireworks-ai:deepseek-v3-0324', 'fireworks-ai:gpt-oss-120b', 'fireworks-ai:gpt-oss-20b', 'fireworks-ai:llama-v3p1-8b-instruct', 'fireworks-ai:llama-v3p3-70b-instruct', 'fireworks-ai:llama4-maverick-instruct-basic', 'fireworks-ai:llama4-scout-instruct-basic', 'google-ai:gemini-2.0-flash', 'google-ai:gemini-2.5-flash', 'google-ai:gemini-2.5-pro', 'groq:gpt-oss-120b', 'groq:gpt-oss-20b', 'groq:llama-3.1-8b-instant', 'groq:llama-3.3-70b-versatile', 'openai:gpt-4.1-2025-04-14', 'openai:gpt-4.1-mini-2025-04-14', 'openai:gpt-4.1-nano-2025-04-14', 'openai:gpt-4o-2024-11-20', 'openai:gpt-4o-mini-2024-07-18', 'openai:gpt-5-2025-08-07', 'openai:gpt-5-mini-2025-08-07', 'openai:gpt-5-nano-2025-08-07', 'openai:gpt-5.1-2025-11-13', 'openai:gpt-5.2-2025-12-11', 'openai:o1-2024-12-17', 'openai:o1-mini-2024-09-12', 'openai:o3-2025-04-16', 'openai:o3-mini-2025-01-31', 'openai:o4-mini-2025-04-16', 'openrouter:gpt-oss-120b', 'xai:grok-3', 'xai:grok-3-mini', 'xai:grok-4-0709', 'xai:grok-4-fast-non-reasoning', 'xai:grok-4-fast-reasoning', 'xai:grok-code-fast-1', 'openai:gpt-5', 'openai:gpt-5-mini', 'openai:gpt-5-nano', 'openai:o4-mini', 'openai:o3', 'openai:gpt-4.1', 'openai:gpt-4.1-mini', 'openai:gpt-4.1-nano', 'openai:o3-mini', 'openai:o1-mini', 'openai:gpt-4o-mini', 'openai:gpt-4o', 'anthropic:claude-sonnet-4-5', 'anthropic:claude-sonnet-4', 'anthropic:claude-sonnet-4-reasoning', 'anthropic:claude-haiku-4-5', 'anthropic:claude-haiku-4-5-reasoning', 'google-ai:models/gemini-2.0-flash', 'groq:openai/gpt-oss-20b', 'groq:openai/gpt-oss-120b', 'fireworks-ai:accounts/fireworks/models/gpt-oss-20b', 'fireworks-ai:accounts/fireworks/models/gpt-oss-120b', 'fireworks-ai:accounts/fireworks/models/deepseek-r1-0528', 'fireworks-ai:accounts/fireworks/models/deepseek-v3-0324', 'fireworks-ai:accounts/fireworks/models/llama4-maverick-instruct-basic', 'fireworks-ai:accounts/fireworks/models/llama4-scout-instruct-basic', 'fireworks-ai:accounts/fireworks/models/llama-v3p3-70b-instruct', 'fireworks-ai:accounts/fireworks/models/deepseek-r1', 'fireworks-ai:accounts/fireworks/models/deepseek-r1-basic', 'fireworks-ai:accounts/fireworks/models/deepseek-v3', 'fireworks-ai:accounts/fireworks/models/llama-v3p1-405b-instruct', 'fireworks-ai:accounts/fireworks/models/llama-v3p1-70b-instruct', 'fireworks-ai:accounts/fireworks/models/llama-v3p1-8b-instruct', 'fireworks-ai:accounts/fireworks/models/mixtral-8x22b-instruct', 'fireworks-ai:accounts/fireworks/models/mixtral-8x7b-instruct', 'fireworks-ai:accounts/fireworks/models/mythomax-l2-13b', 'fireworks-ai:accounts/fireworks/models/gemma2-9b-it'];

                let setCurrentModel = new Autonomous.Tool({
                        name: "setCurrentModel",
                        description: "Tool to be able to set custom models for the current chat prompt",
                        input: z.object({
                                modelName: z.string().describe("Name of the model you want to hotswap to for the current conversation"),
                        }),
                        output: z.boolean(),
                        handler: async ({ modelName }) => {
                                state.currentModel = modelName;
                                if (state.currentModel == modelName) 
                                        return true;
                                return false;
                        }
                });

                let getAllModels = new Autonomous.Tool({
                        name: "getAllModels",
                        description: "Tool to get list of available models to be able to set",
                        input: z.void(),
                        output: z.array(z.string()).describe("Array of models available"),
                        handler: async () => {
                                return models
                        },
                });

                let getCurrentModel = new Autonomous.Tool({
                        name: "getCurrentModel",
                        description: "Get current Model of the state",
                        input: z.void(),
                        output: z.string().describe("Current model being used"),
                        handler: async () => {
                                return state.currentModel;
                        },
                });

                // Tool: Get Last Uploaded Image
                let getLastImage = new Autonomous.Tool({
                        name: "getLastImage",
                        description: "Get the most recently uploaded image for interpretation",
                        input: z.object({}),
                        output: z.object({
                                fileId: z.string(),
                                fileName: z.string(),
                                uploadedAt: z.string(),
                        }).optional(),
                        handler: async () => {
                                if (!state.lastImageId) return undefined;
                                const img = state.uploadedImages.find(i => i.fileId === state.lastImageId);
                                return img ? {
                                        fileId: img.fileId,
                                        fileName: img.fileName,
                                        uploadedAt: img.uploadedAt,
                                } : undefined;
                        },
                });

                // Tool: Get All Uploaded Images
                let getAllImages = new Autonomous.Tool({
                        name: "getAllImages",
                        description: "Get all uploaded images in this conversation",
                        input: z.object({}),
                        output: z.array(z.object({
                                fileId: z.string(),
                                fileName: z.string(),
                                uploadedAt: z.string(),
                                interpretation: z.string().optional(),
                        })),
                        handler: async () => {
                                return state.uploadedImages.map(img => ({
                                        fileId: img.fileId,
                                        fileName: img.fileName,
                                        uploadedAt: img.uploadedAt,
                                        interpretation: img.interpretation,
                                }));
                        },
                });

                // Handle image uploads
                if (message?.type === "file" || message?.type === "bloc") {
                        try {
                                const processed = await processFileMessage(client, message);
                                if (processed) {
                                        // Store in state
                                        state.uploadedImages.push({
                                                ...processed,
                                                uploadedAt: new Date().toISOString(),
                                        });
                                        state.lastImageId = processed.fileId;

                                        // Trim state if too many images
                                        if (state.uploadedImages.length > FILE_CONFIG.MAX_IMAGES_IN_STATE) {
                                                state.uploadedImages = state.uploadedImages.slice(-FILE_CONFIG.MAX_IMAGES_IN_STATE);
                                        }

                                        // Check if current model supports vision
                                        if (!isVisionCapable(state.currentModel)) {
                                                await conversation.send({
                                                        type: "text",
                                                        payload: {
                                                                text: `Image uploaded! However, ${state.currentModel} doesn't support vision. Switching to Claude Sonnet 4.5...`,
                                                        },
                                                });
                                                state.currentModel = "anthropic:claude-sonnet-4-5";
                                        }

                                        // Acknowledge upload
                                        await conversation.send({
                                                type: "text",
                                                payload: {
                                                        text: "Analyzing your image...",
                                                },
                                        });

                                        // Set a default message to trigger interpretation
                                        var userMessage: string = "Please describe what you see in this image in detail.";
                                }
                        } catch (error) {
                                const errorMsg = error instanceof Error ? error.message : String(error);
                                console.error("[IMAGE] Processing failed:", errorMsg);

                                await conversation.send({
                                        type: "text",
                                        payload: {
                                                text: `Failed to process image: ${errorMsg}`,
                                        },
                                });
                                return; // Don't proceed with execute
                        }
                } else {
                        // Original text message handling
                        var userMessage: string = message?.payload?.text?.trim() || "";
                }
                
                await execute({
                        instructions: `You are a multimodel bot that can freely hotswap between models and answer questions.

IMPORTANT CAPABILITIES:
- You can interpret images when they are uploaded
- Use the getLastImage and getAllImages tools to access uploaded images
- If an image was just uploaded, describe it in detail
- You can only set models from the getAllModels list (string must match exactly)

VISION SUPPORT:
- Current model: ${state.currentModel}
- Vision capable: ${isVisionCapable(state.currentModel) ? 'YES' : 'NO'}
- If user uploads an image and current model doesn't support vision, it will auto-switch
- Vision-capable models: Claude (Sonnet/Haiku 4.5), GPT-4o, Gemini 2.x

When an image is uploaded, proactively describe what you see in detail.
When asked about images, reference them using the getLastImage or getAllImages tools.`,
                        tools: [getCurrentModel, getAllModels, setCurrentModel, getLastImage, getAllImages],
                        model: state.currentModel,
                });

        },
});
