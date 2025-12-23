import { Table, z } from "@botpress/runtime";

/**
 * Contract Status Enum
 * Tracks the lifecycle of uploaded contract documents
 */
export const ContractStatus = z.enum([
  "pending",     // Uploaded, waiting to start extraction
  "analyzing",   // Currently extracting clauses
  "completed",   // Extraction complete
  "error",       // Extraction failed
]);

/**
 * Contracts Table
 * Stores metadata about uploaded contract documents
 */
export default new Table({
  name: "contractsTable",
  columns: {
    userId: z.string(), // Owner of this contract
    fileId: z.string(),
    fileKey: z.string(),
    title: {
      schema: z.string(),
      searchable: true,
    },
    counterparty: {
      schema: z.string().optional(),
      searchable: true,
    },
    contractType: z.string().optional(),
    status: ContractStatus,
    clauseCount: z.number().optional(),
    summary: {
      schema: z.string().optional(),
      searchable: true,
    },
    messageId: z.string().optional(),
    errorMessage: z.string().optional(),
  },
});

export type ContractStatus = z.infer<typeof ContractStatus>;
