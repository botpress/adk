import { Table, z } from "@botpress/runtime";
import { ClauseTypeEnum, RiskLevelEnum } from "../utils/constants";

/**
 * Clauses Table
 * Stores extracted contractual clauses with risk level and source citation
 *
 * Note: Import ClauseTypeEnum, RiskLevelEnum, ClauseType, RiskLevel
 * directly from '../utils/constants' - that is the single source of truth.
 */
export default new Table({
  name: "clausesTable",
  columns: {
    userId: z.string(), // Owner of this clause
    contractId: z.number(),
    fileId: z.string(),
    passageId: z.string().optional(),
    clauseType: ClauseTypeEnum,
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
    riskLevel: RiskLevelEnum,
    position: z.number().optional(),
    foundInPassages: z.string().optional(), // JSON array of passage IDs
    // Citation metadata - for source traceability
    pageNumber: z.number().optional(), // Page where clause was found
    passageContent: z.string().optional(), // Full source passage text
  },
});
