import { z } from "@botpress/runtime";

/**
 * Shared constants and enums for clause extraction
 * Single source of truth - import from here, not duplicate
 */

// ============================================================================
// Clause Type Enum
// ============================================================================

export const CLAUSE_TYPES = [
  "payment_terms",
  "liability_limitation",
  "indemnification",
  "termination",
  "confidentiality",
  "force_majeure",
  "warranties",
  "governing_law",
  "dispute_resolution",
  "intellectual_property",
  "assignment",
  "amendment",
  "other",
] as const;

export const ClauseTypeEnum = z.enum(CLAUSE_TYPES);
export type ClauseType = z.infer<typeof ClauseTypeEnum>;

// ============================================================================
// Risk Level Enum
// ============================================================================

export const RISK_LEVELS = ["low", "medium", "high"] as const;

export const RiskLevelEnum = z.enum(RISK_LEVELS);
export type RiskLevel = z.infer<typeof RiskLevelEnum>;

// ============================================================================
// Extraction Configuration
// ============================================================================

export const EXTRACTION_CONFIG = {
  /** Number of parallel batch extractions */
  BATCH_CONCURRENCY: 3,
  /** Max rows per database insert */
  DB_INSERT_BATCH_SIZE: 50,
  /** Passages to fetch per API call */
  PASSAGE_FETCH_LIMIT: 200,
  /** Milliseconds between indexing status checks */
  INDEXING_POLL_INTERVAL_MS: 2000,
  /** Max wait for file indexing to complete */
  INDEXING_TIMEOUT_MS: 120000,
} as const;

// ============================================================================
// Passage Batching Configuration
// ============================================================================

export const BATCHING_CONFIG = {
  /** Minimum passage length to include in batch */
  MIN_PASSAGE_LENGTH: 50,
  /** Maximum passages per extraction batch */
  MAX_BATCH_SIZE: 10,
  /** Target tokens per batch (approximate) */
  TARGET_BATCH_TOKENS: 8000,
} as const;
