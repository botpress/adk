import { Workflow, z } from "@botpress/runtime";
import { parseCSV } from "../utils/csv-parser";
import { validateHeaders, validateRow, rowToSchemaObject, EMAIL_REGEX, type IssueCategory } from "../utils/validators";
import { updateImportProgressComponent } from "../utils/progress";
import { SCHEMAS, mapHeaders } from "../utils/schemas";
import type { ImportSchema, HeaderMapping } from "../utils/schemas";
import { ImportJobsTable } from "../tables/import-jobs";
import { EmployeesTable } from "../tables/employees";
import { ProductsTable } from "../tables/products";
import { TransactionsTable } from "../tables/transactions";

const InputSchema = z.object({
  messageId: z.string().describe("ID of the progress message in the conversation"),
  conversationId: z.string().describe("Conversation ID for sending updates"),
  csvContent: z.string().describe("Raw CSV file content"),
  fileName: z.string().describe("Original file name"),
  schemaType: z.string().describe("Schema type to validate and import against"),
});

const OutputSchema = z.object({
  totalRows: z.number().optional(),
  importedRows: z.number().optional(),
  skippedRows: z.number().optional(),
  errors: z.array(z.string()).optional(),
});

async function insertRow(
  schemaType: string,
  data: Record<string, string>,
  jobId: string,
  rowIndex: number,
  rowStatus: "imported" | "skipped" | "duplicate" | "fixed",
  notes?: string
): Promise<void> {
  const base = { jobId, rowIndex, rowStatus, notes };

  switch (schemaType) {
    case "employees":
      await EmployeesTable.createRows({
        rows: [{
          ...base,
          name: data.name ?? "",
          email: data.email ?? "",
          department: data.department ?? "",
          salary: data.salary || undefined,
          startDate: data.startDate || undefined,
        }],
      });
      break;
    case "products":
      await ProductsTable.createRows({
        rows: [{
          ...base,
          productName: data.productName ?? "",
          sku: data.sku ?? "",
          category: data.category ?? "",
          price: data.price ?? "",
          stockQuantity: data.stockQuantity || undefined,
        }],
      });
      break;
    case "transactions":
      await TransactionsTable.createRows({
        rows: [{
          ...base,
          transactionDate: data.transactionDate ?? "",
          description: data.description ?? "",
          amount: data.amount ?? "",
          category: data.category ?? "",
          paymentMethod: data.paymentMethod || undefined,
        }],
      });
      break;
  }
}

const CATEGORY_CONFIG: Record<IssueCategory, {
  requestKey: string;
  label: string;
}> = {
  column_mismatch: {
    requestKey: "resolve_column_mismatch",
    label: "Column Mismatch",
  },
  missing_required: {
    requestKey: "resolve_missing_required",
    label: "Empty Fields",
  },
  duplicate_row: {
    requestKey: "resolve_duplicate_rows",
    label: "Duplicate Rows",
  },
  invalid_email: {
    requestKey: "resolve_invalid_email",
    label: "Invalid Email",
  },
  invalid_number: {
    requestKey: "resolve_invalid_number",
    label: "Invalid Number",
  },
  invalid_date: {
    requestKey: "resolve_invalid_date",
    label: "Invalid Date",
  },
};

const PROMPTABLE_CATEGORIES: IssueCategory[] = [
  "column_mismatch",
  "missing_required",
  "duplicate_row",
  "invalid_email",
  "invalid_number",
  "invalid_date",
];

function applyResolution(
  category: IssueCategory,
  resolution: string,
  row: string[],
  mapping: Record<number, string>,
  schema: ImportSchema
): { action: "import" | "skip"; row: string[] } {
  const res = resolution.toLowerCase();

  if (res.includes("pad")) {
    const keys = Object.keys(mapping).map(Number);
    if (keys.length === 0) return { action: "skip", row };
    const expectedLen = Math.max(...keys) + 1;
    const patched = [...row];
    while (patched.length < expectedLen) patched.push("N/A");
    return { action: "import", row: patched.slice(0, expectedLen) };
  }

  if (res.includes("skip") || res.includes("remove")) {
    return { action: "skip", row };
  }

  if (res.includes("fill")) {
    const patched = [...row];
    for (const col of schema.columns) {
      const idx = Object.entries(mapping).find(([, name]) => name === col.name)?.[0];
      if (idx !== undefined) {
        const value = patched[Number(idx)] ?? "";
        if (value.trim() === "") {
          patched[Number(idx)] = "N/A";
        }
      }
    }
    return { action: "import", row: patched };
  }

  if (res.includes("clear")) {
    const patched = [...row];
    for (const [idx, colName] of Object.entries(mapping)) {
      const col = schema.columns.find((c) => c.name === colName);
      if (!col) continue;
      const value = patched[Number(idx)] ?? "";
      if (value.trim() === "") continue;
      if (category === "invalid_email" && col.type === "email") {
        if (!EMAIL_REGEX.test(value.trim())) patched[Number(idx)] = "N/A";
      }
      if (category === "invalid_date" && col.type === "date") {
        if (isNaN(new Date(value.trim()).getTime())) patched[Number(idx)] = "N/A";
      }
    }
    return { action: "import", row: patched };
  }

  if (res.includes("set to 0") || res === "0") {
    const patched = [...row];
    for (const [idx, colName] of Object.entries(mapping)) {
      const col = schema.columns.find((c) => c.name === colName);
      if (!col || col.type !== "number") continue;
      const value = patched[Number(idx)] ?? "";
      if (value.trim() === "") continue;
      const cleaned = value.replace(/[$,]/g, "").trim();
      if (isNaN(Number(cleaned))) patched[Number(idx)] = "0";
    }
    return { action: "import", row: patched };
  }

  return { action: "import", row };
}

export default new Workflow({
  name: "csv_import",
  description: "Background CSV import pipeline with validation and interactive error resolution",

  input: InputSchema,
  output: OutputSchema,

  requests: {
    confirm_import: z.object({ resolution: z.string() }),
    resolve_column_mismatch: z.object({ resolution: z.string() }),
    resolve_missing_required: z.object({ resolution: z.string() }),
    resolve_duplicate_rows: z.object({ resolution: z.string() }),
    resolve_invalid_email: z.object({ resolution: z.string() }),
    resolve_invalid_number: z.object({ resolution: z.string() }),
    resolve_invalid_date: z.object({ resolution: z.string() }),
  },

  handler: async ({ step, input, workflow }) => {
    const { messageId, csvContent, fileName, schemaType } = input;

    const schema: ImportSchema | undefined = SCHEMAS[schemaType];
    if (!schema) {
      const failMsg = `Your CSV columns don't match any supported schema. Please select a schema (Employees, Products, or Transactions) first, then upload your file.`;
      await updateImportProgressComponent(messageId, {
        progress: 100,
        status: "errored",
        summary: failMsg,
      });
      workflow.fail(failMsg);
      return { totalRows: 0, importedRows: 0, skippedRows: 0, errors: [] };
    }

    const parsed = await step("parse-csv", async () => {
      await updateImportProgressComponent(messageId, {
        progress: 5,
        status: "parsing",
        currentPhase: "Parsing CSV file…",
      });

      let result;
      try {
        result = parseCSV(csvContent);
      } catch (err: any) {
        workflow.fail("Invalid CSV format: " + (err.message ?? "unknown error"));
        return { headers: [] as string[], rows: [] as string[][], totalRows: 0 };
      }

      if (result.headers.length === 0) {
        workflow.fail("Invalid CSV: no headers found. Is this a valid CSV file?");
        return { headers: [] as string[], rows: [] as string[][], totalRows: 0 };
      }

      if (result.totalRows === 0) {
        workflow.fail("CSV file is empty — no data rows found.");
        return { headers: [] as string[], rows: [] as string[][], totalRows: 0 };
      }

      await updateImportProgressComponent(messageId, {
        progress: 10,
        status: "parsing",
        totalRows: result.totalRows,
        currentPhase: `Parsed ${result.totalRows} rows with ${result.headers.length} columns`,
      });

      return { headers: result.headers, rows: result.rows, totalRows: result.totalRows };
    });

    const headerResult = await step("map-headers", async () => {
      const mapping = mapHeaders(parsed.headers, schema);
      const validation = validateHeaders(parsed.headers, schema, mapping);

      if (!validation.valid) {
        workflow.fail(validation.error!);
        return { mapping: {} as HeaderMapping["mapping"], warning: undefined as string | undefined };
      }

      return { mapping: mapping.mapping, warning: validation.warning, extra: mapping.extra };
    });

    const columnMapping = headerResult.mapping;

    if (parsed.totalRows > 100) {
      workflow.setTimeout({ in: "5m" });
    }

    const mappedCols = schema.columns
      .filter((c) => Object.values(columnMapping).includes(c.name))
      .map((c) => c.label)
      .join(", ");

    const previewRows = parsed.rows.slice(0, 3);
    const headerRow = `| ${parsed.headers.join(" | ")} |`;
    const separatorRow = `| ${parsed.headers.map(() => "---").join(" | ")} |`;
    const dataRows = previewRows.map(
      (row) => `| ${row.map((cell) => cell || "—").join(" | ")} |`
    );

    const previewLines = [
      `**${fileName}**`,
      `${parsed.totalRows} rows, ${parsed.headers.length} columns`,
      "",
      `**Mapped columns:** ${mappedCols}`,
    ];

    if (headerResult.warning) {
      previewLines.push(`⚠ ${headerResult.warning}`);
    }

    previewLines.push(
      "",
      "Preview of the first 3 rows:",
      "",
      headerRow,
      separatorRow,
      ...dataRows,
      "",
      `Ready to import all ${parsed.totalRows} rows? (**yes** / **no**)`
    );

    const previewText = previewLines.join("\n");

    await updateImportProgressComponent(messageId, {
      progress: 12,
      status: "parsing",
      currentPhase: "Waiting for your confirmation…",
      pendingQuestion: "Check the chat to confirm the import",
    });

    const { resolution: confirmResolution } = await step.request("confirm_import", previewText);

    if (confirmResolution.toLowerCase().includes("no") || confirmResolution.toLowerCase().includes("cancel")) {
      workflow.fail("Import declined by user.");
      return { totalRows: parsed.totalRows, importedRows: 0, skippedRows: 0, errors: [] };
    }

    await updateImportProgressComponent(messageId, {
      progress: 20,
      status: "validating",
      currentPhase: "Validating rows…",
    });

    const jobId = `${fileName}-${Date.now()}`;

    type RowResult = { index: number; row: string[]; status: "valid" | "warning" | "error"; category?: IssueCategory; message: string };
    const rowResults: RowResult[] = await step("validate-all-rows", () => {
      const seenRows = new Set<string>();
      const results: RowResult[] = [];
      for (let i = 0; i < parsed.rows.length; i++) {
        const row = parsed.rows[i];
        const validation = validateRow(row, parsed.headers, columnMapping, schema, seenRows);
        results.push({ index: i, row, status: validation.status, category: validation.category, message: validation.message ?? "" });
      }
      return results;
    });

    await updateImportProgressComponent(messageId, {
      progress: 35,
      status: "validating",
      currentPhase: "Validation complete, reviewing results…",
    });

    const resolutions: Partial<Record<IssueCategory, string>> = {};

    for (const category of PROMPTABLE_CATEGORIES) {
      const categoryRows = rowResults.filter((r) => r.category === category);
      if (categoryRows.length === 0) continue;

      const config = CATEGORY_CONFIG[category];

      const lines = categoryRows.slice(0, 10).map((r) => {
        const rowData = rowToSchemaObject(r.row, columnMapping);
        const preview = Object.entries(rowData)
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${v || "*(empty)*"}`)
          .join(", ");
        return `  • **Row ${r.index + 1}** — ${r.message} (${preview})`;
      });
      if (categoryRows.length > 10) {
        lines.push(`  • …and ${categoryRows.length - 10} more`);
      }

      const prompt = [
        `**${config.label}** — ${categoryRows.length} row${categoryRows.length > 1 ? "s" : ""}:`,
        "",
        ...lines,
        "",
        "How would you like to handle this?",
      ].join("\n");

      await updateImportProgressComponent(messageId, {
        progress: 38,
        status: "validating",
        currentPhase: `Waiting for your decision on ${config.label.toLowerCase()}…`,
        pendingQuestion: `Check the chat to decide on ${config.label.toLowerCase()}`,
      });

      const { resolution } = await step.request(config.requestKey as any, prompt);
      resolutions[category] = resolution;
    }

    await updateImportProgressComponent(messageId, {
      progress: 45,
      status: "importing",
      currentPhase: "Importing rows…",
    });

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    const allRows = rowResults;
    for (let i = 0; i < allRows.length; i++) {
      const r = allRows[i];

      if (r.status === "valid") {
        const rowData = rowToSchemaObject(r.row, columnMapping);
        try {
          await step(`import-row-${r.index}`, async () => {
            await insertRow(schemaType, rowData, jobId, r.index + 1, "imported");
          });
          importedCount++;
        } catch (err: any) {
          errors.push(`Row ${r.index + 1}: ${err.message ?? "insert failed"}`);
          skippedCount++;
        }
      } else if (r.category) {
        const resolution = resolutions[r.category] ?? "skip";
        const result = applyResolution(r.category, resolution, r.row, columnMapping, schema);

        if (result.action === "import") {
          const rowData = rowToSchemaObject(result.row, columnMapping);
          const wasFixed = result.row.some((cell, idx) => cell !== r.row[idx]);
          try {
            await step(`import-row-${r.index}`, async () => {
              await insertRow(schemaType, rowData, jobId, r.index + 1, wasFixed ? "fixed" : "imported", r.message);
            });
            importedCount++;
          } catch (err: any) {
            errors.push(`Row ${r.index + 1}: ${err.message ?? "insert failed"}`);
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }

      if (i % 5 === 0 || i === allRows.length - 1) {
        const progress = 45 + Math.round(((i + 1) / allRows.length) * 45);
        await updateImportProgressComponent(messageId, {
          progress,
          status: "importing",
          importedRows: importedCount,
          skippedRows: skippedCount,
          currentPhase: `Importing row ${i + 1} of ${allRows.length}…`,
        });
      }
    }

    if (parsed.totalRows > 0 && skippedCount > parsed.totalRows / 2) {
      await updateImportProgressComponent(messageId, {
        progress: 95,
        status: "errored",
        errors,
        summary: `Import failed: ${skippedCount} of ${parsed.totalRows} rows had errors (>50% threshold).`,
      });
      workflow.fail(`Too many errors: ${skippedCount} of ${parsed.totalRows} rows failed (>50% threshold).`);
      return { totalRows: parsed.totalRows, importedRows: importedCount, skippedRows: skippedCount, errors };
    }

    await step("finalize", async () => {
      await ImportJobsTable.createRows({
        rows: [
          {
            fileName,
            totalRows: parsed.totalRows,
            importedRows: importedCount,
            skippedRows: skippedCount,
            status: "completed" as const,
            schemaType,
            conversationId: input.conversationId,
            messageId,
            errorMessage: undefined,
            completedAt: new Date().toISOString(),
          },
        ],
      });

      const parts = [`${importedCount}/${parsed.totalRows} rows imported to Botpress table`];
      if (skippedCount > 0) parts.push(`${skippedCount} skipped`);
      if (errors.length > 0) parts.push(`${errors.length} errors`);
      const summary = parts.join(" · ");

      await updateImportProgressComponent(messageId, {
        progress: 100,
        status: "done",
        importedRows: importedCount,
        skippedRows: skippedCount,
        errors,
        summary,
      });
    });

    return {
      totalRows: parsed.totalRows,
      importedRows: importedCount,
      skippedRows: skippedCount,
      errors,
    };
  },
});
