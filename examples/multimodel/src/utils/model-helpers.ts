import { VISION_CAPABLE_MODELS } from './constants';

/**
 * Check if a model supports vision/image interpretation
 */
export function isVisionCapable(modelName: string): boolean {
  return VISION_CAPABLE_MODELS.includes(modelName);
}

/**
 * Get a user-friendly display name for a model
 */
export function getModelDisplayName(modelName: string): string {
  const parts = modelName.split(':');
  if (parts.length === 2) {
    const [provider, model] = parts;
    return `${model} (${provider})`;
  }
  return modelName;
}
