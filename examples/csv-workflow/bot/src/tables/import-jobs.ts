import { Table, z } from "@botpress/runtime";

export const ImportJobsTable = new Table({
  name: "importjobsTable",
  columns: {
    fileName: z.string().describe("Original CSV file name"),
    totalRows: z.number().describe("Total rows in the CSV file"),
    importedRows: z.number().describe("Number of rows successfully imported"),
    skippedRows: z.number().describe("Number of rows skipped due to errors"),
    status: z
      .enum(["pending", "parsing", "validating", "importing", "completed", "failed", "cancelled"])
      .describe("Current import job status"),
    conversationId: z.string().describe("Conversation that initiated the import"),
    messageId: z.string().describe("Progress message ID for UI updates"),
    schemaType: z.string().describe("Schema type used for this import"),
    errorMessage: z.string().optional().describe("Error details if the import failed"),
    completedAt: z.string().optional().describe("ISO timestamp when the import finished"),
  },
});
