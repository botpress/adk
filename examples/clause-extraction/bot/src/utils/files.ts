import { client } from "@botpress/runtime";
import type { Passage } from "./extraction";
import { EXTRACTION_CONFIG } from "./constants";

const {
  INDEXING_TIMEOUT_MS,
  INDEXING_POLL_INTERVAL_MS,
  PASSAGE_FETCH_LIMIT,
} = EXTRACTION_CONFIG;

/**
 * Files API helpers
 * Uses the ADK runtime client's _inner to access full @botpress/client API
 *
 * Note: BotSpecificClient doesn't expose listFilePassages/getFile, so we use _inner
 * to access the underlying @botpress/client directly.
 */

/**
 * Interface for the inner client with Files API methods
 * This is a workaround since BotSpecificClient doesn't expose these methods directly
 */
interface FileRecord {
  status: string;
  failedStatusReason?: string;
}

interface PassageRecord {
  id: string;
  content: string;
  meta?: Record<string, unknown>;
}

interface InnerClientWithFilesAPI {
  getFile: (params: { id: string }) => Promise<{ file: FileRecord }>;
  listFilePassages: (params: {
    id: string;
    limit?: number;
    nextToken?: string;
  }) => Promise<{
    passages: PassageRecord[];
    meta: { nextToken?: string };
  }>;
}

// Get the inner client for full API access
function getInnerClient(): InnerClientWithFilesAPI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any)._inner;
}

/**
 * Options for indexing wait operations
 */
export interface IndexingWaitOptions {
  /** Maximum time to wait for indexing (default: 120000ms) */
  maxWaitMs?: number;
  /** Callback fired on each poll with current status and elapsed seconds */
  onStatusChange?: (status: string, elapsedSec: number) => void | Promise<void>;
}

/**
 * Wait for file indexing to complete before fetching passages
 * Polls the file status until indexing_completed or timeout
 */
export async function waitForIndexing(
  fileId: string,
  options: IndexingWaitOptions = {}
): Promise<void> {
  const { maxWaitMs = INDEXING_TIMEOUT_MS, onStatusChange } = options;
  const innerClient = getInnerClient();
  const startTime = Date.now();
  const pollInterval = INDEXING_POLL_INTERVAL_MS;

  console.debug(`[FILES] Waiting for indexing to complete for ${fileId}...`);

  while (Date.now() - startTime < maxWaitMs) {
    const elapsedSec = Math.round((Date.now() - startTime) / 1000);

    let file;
    try {
      // Try with id first, fall back to key if it fails
      const response = await innerClient.getFile({ id: fileId });
      file = response.file;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      // If resource not found, file may not be created yet - wait and retry
      if (errorMessage.includes("Resource not found") || errorMessage.includes("not found")) {
        console.debug(`[FILES] File not found yet, waiting... (${elapsedSec}s)`);
        if (onStatusChange) {
          await onStatusChange("waiting_for_upload", elapsedSec);
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }
      throw err;
    }

    // Notify callback of current status
    if (onStatusChange) {
      await onStatusChange(file.status, elapsedSec);
    }

    if (file.status === "indexing_completed") {
      console.debug("[FILES] Indexing completed!");
      return;
    }

    if (file.status === "indexing_failed") {
      throw new Error(
        `Indexing failed: ${file.failedStatusReason || "unknown reason"}`
      );
    }

    console.debug(`[FILES] Indexing status: ${file.status} (${elapsedSec}s)...`);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Indexing timed out after ${maxWaitMs}ms`);
}

/**
 * Get all passages for a file from the Files API
 * Waits for indexing to complete first, then handles pagination
 */
export async function getPassages(
  fileId: string,
  options?: IndexingWaitOptions
): Promise<Passage[]> {
  console.debug(`[FILES] Fetching passages for file ${fileId}...`);

  // Wait for indexing to complete before fetching passages
  await waitForIndexing(fileId, options);

  const innerClient = getInnerClient();
  const allPassages: Passage[] = [];
  let nextToken: string | undefined;

  do {
    const response = await innerClient.listFilePassages({
      id: fileId,
      limit: PASSAGE_FETCH_LIMIT,
      nextToken,
    });

    for (const p of response.passages) {
      allPassages.push({
        id: p.id,
        content: p.content,
        metadata: p.meta as Passage["metadata"],
      });
    }

    nextToken = response.meta?.nextToken;
  } while (nextToken);

  console.debug(`[FILES] Found ${allPassages.length} passages`);

  return allPassages;
}
