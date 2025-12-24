/**
 * File Upload Utility
 *
 * Handles file uploads to Botpress Files API from various sources.
 * Supports both direct Files API uploads and webchat URL re-uploads.
 */

import type { Client } from "@botpress/client";

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
 * Handles:
 * - Direct file messages (type: "file")
 * - Bloc messages containing file items (type: "bloc" with items array)
 * - Both Files API uploads (with fileId) and webchat uploads (with fileUrl)
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

    // Find the first file item in the bloc
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
  // Direct Files API upload (preferred - has fileId)
  if (payload.fileId) {
    return {
      fileId: payload.fileId,
      fileName: payload.title || "contract.pdf",
    };
  }

  // Webchat upload (has fileUrl, needs re-upload for passage extraction)
  if (payload.fileUrl) {
    const urlFileName = payload.fileUrl.split("/").pop()?.split("?")[0];
    return {
      fileUrl: payload.fileUrl,
      fileName: payload.title || urlFileName || "contract.pdf",
    };
  }

  return null;
}

// ============================================================================
// URL Re-upload
// ============================================================================

/**
 * Re-upload a file from URL to Botpress Files API.
 * Used as fallback when files come via webchat (S3 URLs).
 * Enables passage extraction by setting index: true.
 */
export async function uploadFromUrl(
  client: Client,
  fileUrl: string,
  fileName: string
): Promise<{ fileId: string }> {
  console.debug("[FILE] Uploading from URL:", { fileUrl, fileName });

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.statusText}`);
  }

  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const buffer = await response.arrayBuffer();

  const result = await client.uploadFile({
    key: `contracts/${Date.now()}-${fileName}`,
    content: Buffer.from(buffer),
    contentType,
    index: true,
    tags: {
      type: "contract",
      filename: fileName,
      uploadedAt: new Date().toISOString(),
      source: "webchat-reupload",
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day
  });

  console.debug("[FILE] Upload complete:", { fileId: result.file.id });
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

  // Direct Files API upload
  if (fileInfo.fileId) {
    console.debug("[FILE] Direct Files API upload:", fileInfo.fileName);
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
