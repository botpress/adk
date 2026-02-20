import { Table, z } from "@botpress/runtime";

export const TransactionsTable = new Table({
  name: "transactionsTable",
  columns: {
    jobId: z.string().describe("ID of the import job this row belongs to"),
    rowIndex: z.number().describe("Original row number in the CSV file (0-based)"),
    transactionDate: z.string().describe("Transaction date"),
    description: z.string().describe("Transaction description"),
    amount: z.string().describe("Transaction amount"),
    category: z.string().describe("Transaction category"),
    paymentMethod: z.string().optional().describe("Payment method used"),
    rowStatus: z
      .enum(["imported", "skipped", "duplicate", "fixed"])
      .describe("How this row was handled during import"),
    notes: z.string().optional().describe("Notes about any issues or fixes applied to this row"),
  },
});
