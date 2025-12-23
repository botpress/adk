/**
 * Smart Passage Batching
 *
 * Groups passages into batches using document structure (titles/subtitles as boundaries)
 * with a maximum batch size for safety.
 *
 * Strategy:
 * 1. Skip noise passages (too short, headers without content)
 * 2. Group by sections (title/subtitle marks a new section)
 * 3. Cap batches at MAX_BATCH_SIZE
 * 4. Track section context for better LLM understanding
 */

import type { Passage } from "./extraction";

// Configuration
const MIN_PASSAGE_LENGTH = 50; // Skip passages shorter than this
const MAX_BATCH_SIZE = 10; // Maximum passages per batch
const HEADER_SUBTYPES = ["title", "subtitle"]; // Subtypes that mark section boundaries

/**
 * A batch of passages with section context
 */
export interface PassageBatch {
  /** Unique batch identifier */
  batchIndex: number;
  /** Section header if this batch starts with one */
  sectionHeader?: string;
  /** Passages in this batch (content only, no headers) */
  passages: Passage[];
  /** Stats about this batch */
  stats: {
    totalChars: number;
    pageRange?: { start: number; end: number };
  };
}

/**
 * Result of batching passages
 */
export interface BatchingResult {
  batches: PassageBatch[];
  skipped: {
    passages: Passage[];
    reasons: Record<string, number>;
  };
  stats: {
    totalPassages: number;
    contentPassages: number;
    skippedPassages: number;
    batchCount: number;
    avgBatchSize: number;
  };
}

/**
 * Check if a passage is a section header
 */
function isHeader(passage: Passage): boolean {
  const subtype = (passage.metadata as { subtype?: string })?.subtype;
  return HEADER_SUBTYPES.includes(subtype || "");
}

/**
 * Check if a passage should be skipped (noise)
 */
function shouldSkip(passage: Passage): { skip: boolean; reason?: string } {
  // Too short
  if (passage.content.length < MIN_PASSAGE_LENGTH) {
    return { skip: true, reason: "too_short" };
  }

  // Header-only passages (no content value for extraction)
  const subtype = (passage.metadata as { subtype?: string })?.subtype;
  if (HEADER_SUBTYPES.includes(subtype || "") && passage.content.length < 100) {
    return { skip: true, reason: "header_only" };
  }

  return { skip: false };
}

/**
 * Get page number from passage metadata
 */
function getPageNumber(passage: Passage): number | undefined {
  return (passage.metadata as { pageNumber?: number })?.pageNumber;
}

/**
 * Smart batch passages by document sections
 *
 * Groups consecutive passages together, breaking on:
 * - Title/subtitle boundaries (new section)
 * - MAX_BATCH_SIZE limit
 */
export function batchPassages(passages: Passage[]): BatchingResult {
  const batches: PassageBatch[] = [];
  const skippedPassages: Passage[] = [];
  const skipReasons: Record<string, number> = {};

  let currentBatch: Passage[] = [];
  let currentSectionHeader: string | undefined;
  let batchIndex = 0;

  const flushBatch = () => {
    if (currentBatch.length === 0) return;

    const pages = currentBatch
      .map(getPageNumber)
      .filter((p): p is number => p !== undefined);

    batches.push({
      batchIndex: batchIndex++,
      sectionHeader: currentSectionHeader,
      passages: [...currentBatch],
      stats: {
        totalChars: currentBatch.reduce((sum, p) => sum + p.content.length, 0),
        pageRange:
          pages.length > 0
            ? { start: Math.min(...pages), end: Math.max(...pages) }
            : undefined,
      },
    });

    currentBatch = [];
    currentSectionHeader = undefined;
  };

  for (const passage of passages) {
    // Check if should skip
    const skipCheck = shouldSkip(passage);
    if (skipCheck.skip) {
      skippedPassages.push(passage);
      skipReasons[skipCheck.reason!] =
        (skipReasons[skipCheck.reason!] || 0) + 1;
      continue;
    }

    // Check if this is a section boundary (header with substantial content)
    if (isHeader(passage) && passage.content.length >= 100) {
      // Flush current batch before starting new section
      flushBatch();
      currentSectionHeader = passage.content.trim();
      // Include the header passage if it has substantial content
      currentBatch.push(passage);
      continue;
    }

    // Check if header starts a new section (even if short, use as context)
    if (isHeader(passage)) {
      // Short header - use as section context for next batch
      flushBatch();
      currentSectionHeader = passage.content.trim();
      // Don't include short headers in batch content
      continue;
    }

    // Check if batch is full
    if (currentBatch.length >= MAX_BATCH_SIZE) {
      flushBatch();
    }

    // Add to current batch
    currentBatch.push(passage);
  }

  // Flush any remaining
  flushBatch();

  const contentPassages = passages.length - skippedPassages.length;

  return {
    batches,
    skipped: {
      passages: skippedPassages,
      reasons: skipReasons,
    },
    stats: {
      totalPassages: passages.length,
      contentPassages,
      skippedPassages: skippedPassages.length,
      batchCount: batches.length,
      avgBatchSize:
        batches.length > 0
          ? Math.round(contentPassages / batches.length * 10) / 10
          : 0,
    },
  };
}

/**
 * Format a batch for LLM extraction
 * Includes section context and clear passage separators
 */
export function formatBatchForExtraction(batch: PassageBatch): string {
  const lines: string[] = [];

  // Add section context if available
  if (batch.sectionHeader) {
    lines.push(`SECTION CONTEXT: ${batch.sectionHeader}`);
    lines.push("");
  }

  // Add each passage with clear separators
  batch.passages.forEach((passage, i) => {
    const pageInfo = getPageNumber(passage)
      ? ` (Page ${getPageNumber(passage)})`
      : "";
    lines.push(`--- PASSAGE ${i + 1}${pageInfo} ---`);
    lines.push(passage.content);
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Get a human-readable summary of batching for UI
 */
export function getBatchingSummary(result: BatchingResult): string {
  const { stats, skipped } = result;

  const parts = [
    `${stats.contentPassages} passages in ${stats.batchCount} batches`,
    `(avg ${stats.avgBatchSize}/batch)`,
  ];

  if (stats.skippedPassages > 0) {
    const reasons = Object.entries(skipped.reasons)
      .map(([reason, count]) => `${count} ${reason.replace("_", " ")}`)
      .join(", ");
    parts.push(`• Skipped: ${reasons}`);
  }

  return parts.join(" ");
}
