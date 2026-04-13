/**
 * Constants for file upload and model capabilities
 */

// Vision-capable models from the available model list
export const VISION_CAPABLE_MODELS = [
  // Anthropic
  'anthropic:claude-sonnet-4-5',
  'anthropic:claude-sonnet-4',
  'anthropic:claude-haiku-4-5',
  'anthropic:claude-3-5-haiku-20241022',
  'anthropic:claude-3-7-sonnet-20250219',

  // OpenAI
  'openai:gpt-4o',
  'openai:gpt-4o-mini',
  'openai:gpt-4.1',
  'openai:gpt-5',

  // Google AI
  'google-ai:gemini-2.0-flash',
  'google-ai:gemini-2.5-flash',
  'google-ai:gemini-2.5-pro',
];

export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

export const FILE_CONFIG = {
  MAX_SIZE_MB: 10,
  EXPIRY_HOURS: 24,
  MAX_IMAGES_IN_STATE: 10, // Keep last 10 images to prevent state bloat
};
