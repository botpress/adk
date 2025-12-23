import { Table, z } from "@botpress/runtime";
import { ClauseTypeEnum, RiskLevelEnum } from "../utils/constants";

// Re-export for backwards compatibility
export const ClauseType = ClauseTypeEnum;
export const RiskLevel = RiskLevelEnum;

/**
 * Clauses Table
 * Stores extracted contractual clauses with risk level
 */
export default new Table({
  name: "clausesTable",
  columns: {
    userId: z.string(), // Owner of this clause
    contractId: z.number(),
    fileId: z.string(),
    passageId: z.string().optional(),
    clauseType: ClauseType,
    title: {
      schema: z.string(),
      searchable: true,
    },
    section: z.string().optional(),
    text: {
      schema: z.string(),
      searchable: true,
    },
    // JSON strings for structured data
    keyPoints: {
      schema: z.string(), // JSON array of strings
      searchable: true,
    },
    riskLevel: RiskLevel,
    position: z.number().optional(),
    foundInPassages: z.string().optional(), // JSON array of passage IDs
  },
});

export type ClauseType = z.infer<typeof ClauseType>;
export type RiskLevel = z.infer<typeof RiskLevel>;
