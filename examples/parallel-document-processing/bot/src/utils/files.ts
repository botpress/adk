import { client } from "@botpress/runtime";

const INDEXING_TIMEOUT_MS = 120_000;
const INDEXING_POLL_INTERVAL_MS = 1_000;
const PASSAGE_FETCH_LIMIT = 200;

interface FileRecord {
  status: string;
  failedStatusReason?: string;
}

interface PassageRecord {
  content: string;
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

function getInnerClient(): InnerClientWithFilesAPI {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any)._inner;
}

/**
 * Wait for file indexing to complete before fetching passages.
 * Polls the file status every 2s until indexing_completed or timeout.
 */
export async function waitForIndexing(fileId: string): Promise<void> {
  const innerClient = getInnerClient();
  const startTime = Date.now();

  while (Date.now() - startTime < INDEXING_TIMEOUT_MS) {
    const { file } = await innerClient.getFile({ id: fileId });

    if (file.status === "indexing_completed") {
      return;
    }

    if (file.status === "indexing_failed") {
      throw new Error(
        `Indexing failed: ${file.failedStatusReason || "unknown reason"}`,
      );
    }

    await new Promise((resolve) =>
      setTimeout(resolve, INDEXING_POLL_INTERVAL_MS),
    );
  }

  throw new Error(`Indexing timed out after ${INDEXING_TIMEOUT_MS}ms`);
}

/**
 * Get all passage text for a file from the Files API.
 * Waits for indexing, then paginates all passages and concatenates their content.
 */
export async function getFileText(fileId: string): Promise<string> {
  await waitForIndexing(fileId);

  const innerClient = getInnerClient();
  const allContent: string[] = [];
  let nextToken: string | undefined;

  do {
    const response = await innerClient.listFilePassages({
      id: fileId,
      limit: PASSAGE_FETCH_LIMIT,
      nextToken,
    });

    for (const p of response.passages) {
      allContent.push(p.content);
    }

    nextToken = response.meta?.nextToken;
  } while (nextToken);

  return allContent.join("\n\n");
}
