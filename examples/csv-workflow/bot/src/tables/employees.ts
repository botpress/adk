import { Table, z } from "@botpress/runtime";

export const EmployeesTable = new Table({
  name: "employeesTable",
  columns: {
    jobId: z.string().describe("ID of the import job this row belongs to"),
    rowIndex: z.number().describe("Original row number in the CSV file (0-based)"),
    name: z.string().describe("Employee full name"),
    email: z.string().describe("Employee email address"),
    department: z.string().describe("Department name"),
    salary: z.string().optional().describe("Annual salary"),
    startDate: z.string().optional().describe("Employment start date"),
    rowStatus: z
      .enum(["imported", "skipped", "duplicate", "fixed"])
      .describe("How this row was handled during import"),
    notes: z.string().optional().describe("Notes about any issues or fixes applied to this row"),
  },
});
