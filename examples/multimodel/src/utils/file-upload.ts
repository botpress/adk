/**
 * File Upload Utility
 *
 * Handles file uploads from webchat to Botpress Files API.
 * Adapted from clause-extraction example but simplified for image handling.
 */

import type { Client } from "@botpress/client";
import { SUPPORTED_IMAGE_TYPES, FILE_CONFIG } from './constants';

// ============================================================================
// Types
// ============================================================================

export interface UploadedFile {
  fileId: string;
  fileName: string;
  source: "files-api" | "webchat-reupload";
}

export interface FileFromMessage {
  fileUrl?: string;
  fileId?: string;
  fileName: string;
}

// ============================================================================
// Message Parsing
// ============================================================================

/**
 * Extract file info from a message payload.
 * Handles both direct file messages and bloc messages containing files.
 */
export function extractFileFromMessage(message: {
  type: string;
  payload: Record<string, unknown>;
}): FileFromMessage | null {
  // Handle bloc messages (composite messages with multiple items)
  if (message.type === "bloc") {
    const blocPayload = message.payload as {
      items?: Array<{
        type: string;
        payload: { fileUrl?: string; fileId?: string; title?: string };
      }>;
    };

    const fileItem = blocPayload.items?.find((item) => item.type === "file");
    if (fileItem) {
      return extractFileInfoFromPayload(fileItem.payload);
    }
    return null;
  }

  // Handle direct file messages
  if (message.type === "file") {
    const payload = message.payload as {
      fileUrl?: string;
      fileId?: string;
      title?: string;
    };
    return extractFileInfoFromPayload(payload);
  }

  return null;
}

/**
 * Extract file info from a file payload object
 */
function extractFileInfoFromPayload(payload: {
  fileUrl?: string;
  fileId?: string;
  title?: string;
}): FileFromMessage | null {
  // Direct Files API upload (preferred)
  if (payload.fileId) {
    return {
      fileId: payload.fileId,
      fileName: payload.title || "image.png",
    };
  }

  // Webchat upload (has fileUrl, needs re-upload)
  if (payload.fileUrl) {
    const urlFileName = payload.fileUrl.split("/").pop()?.split("?")[0];
    return {
      fileUrl: payload.fileUrl,
      fileName: payload.title || urlFileName || "image.png",
    };
  }

  return null;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Check if a file is an image based on filename extension
 */
export function isImageFile(fileName: string): boolean {
  const ext = fileName.toLowerCase();
  return /\.(png|jpg|jpeg|gif|webp)$/i.test(ext);
}

// ============================================================================
// URL Re-upload
// ============================================================================

/**
 * Re-upload a file from URL to Botpress Files API.
 * Used when files come via webchat (S3 URLs).
 *
 * Note: index: false because we don't need passage extraction for images
 */
export async function uploadFromUrl(
  client: Client,
  fileUrl: string,
  fileName: string
): Promise<{ fileId: string }> {
  console.debug("[IMAGE] Uploading from URL:", { fileUrl, fileName });

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";

  // Validate it's an image MIME type
  if (!SUPPORTED_IMAGE_TYPES.includes(contentType)) {
    throw new Error(`Unsupported file type: ${contentType}. Please upload an image (PNG, JPG, GIF, WebP).`);
  }

  const buffer = await response.arrayBuffer();

  // Check file size
  const sizeMB = buffer.byteLength / (1024 * 1024);
  if (sizeMB > FILE_CONFIG.MAX_SIZE_MB) {
    throw new Error(`File too large (${sizeMB.toFixed(1)}MB). Maximum: ${FILE_CONFIG.MAX_SIZE_MB}MB`);
  }

  const result = await client.uploadFile({
    key: `images/${Date.now()}-${fileName}`,
    content: Buffer.from(buffer),
    contentType,
    index: false, // No indexing needed for direct image viewing
    tags: {
      type: "image",
      filename: fileName,
      uploadedAt: new Date().toISOString(),
      source: "webchat-reupload",
    },
    expiresAt: new Date(Date.now() + FILE_CONFIG.EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
  });

  console.debug("[IMAGE] Upload complete:", { fileId: result.file.id });
  return { fileId: result.file.id };
}

// ============================================================================
// Unified Handler
// ============================================================================

/**
 * Process a file message and return uploaded file info.
 * Handles both direct Files API uploads and webchat URL re-uploads.
 */
export async function processFileMessage(
  client: Client,
  message: { type: string; payload: Record<string, unknown> }
): Promise<UploadedFile | null> {
  const fileInfo = extractFileFromMessage(message);
  if (!fileInfo) {
    return null;
  }

  // Validate it's an image file
  if (!isImageFile(fileInfo.fileName)) {
    throw new Error("Only image files are supported (PNG, JPG, GIF, WebP)");
  }

  // Direct Files API upload
  if (fileInfo.fileId) {
    console.debug("[IMAGE] Direct Files API upload:", fileInfo.fileName);
    return {
      fileId: fileInfo.fileId,
      fileName: fileInfo.fileName,
      source: "files-api",
    };
  }

  // Webchat URL - re-upload to Files API
  if (fileInfo.fileUrl) {
    const { fileId } = await uploadFromUrl(
      client,
      fileInfo.fileUrl,
      fileInfo.fileName
    );
    return {
      fileId,
      fileName: fileInfo.fileName,
      source: "webchat-reupload",
    };
  }

  return null;
}
