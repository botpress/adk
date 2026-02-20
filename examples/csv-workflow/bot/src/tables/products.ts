import { Table, z } from "@botpress/runtime";

export const ProductsTable = new Table({
  name: "productsTable",
  columns: {
    jobId: z.string().describe("ID of the import job this row belongs to"),
    rowIndex: z.number().describe("Original row number in the CSV file (0-based)"),
    productName: z.string().describe("Product display name"),
    sku: z.string().describe("Stock keeping unit identifier"),
    category: z.string().describe("Product category"),
    price: z.string().describe("Product price"),
    stockQuantity: z.string().optional().describe("Current stock quantity"),
    rowStatus: z
      .enum(["imported", "skipped", "duplicate", "fixed"])
      .describe("How this row was handled during import"),
    notes: z.string().optional().describe("Notes about any issues or fixes applied to this row"),
  },
});
