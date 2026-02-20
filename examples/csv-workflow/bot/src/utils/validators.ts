import type { ImportSchema, HeaderMapping } from "./schemas";

export type IssueCategory =
  | "column_mismatch"
  | "missing_required"
  | "duplicate_row"
  | "invalid_email"
  | "invalid_number"
  | "invalid_date";

export interface ValidationResult {
  status: "valid" | "warning" | "error";
  category?: IssueCategory;
  message?: string;
  fields?: Record<string, string>;
}

export function validateHeaders(
  csvHeaders: string[],
  schema: ImportSchema,
  mapping: HeaderMapping
): { valid: boolean; error?: string; warning?: string } {
  if (Object.keys(mapping.mapping).length === 0) {
    return {
      valid: false,
      error: `No matching columns found. CSV has: ${csvHeaders.join(", ")}`,
    };
  }

  const warnings: string[] = [];
  if (mapping.missing.length > 0) {
    warnings.push(`Unmatched columns (will be empty): ${mapping.missing.join(", ")}`);
  }
  if (mapping.extra.length > 0) {
    warnings.push(`Extra columns will be ignored: ${mapping.extra.join(", ")}`);
  }

  return { valid: true, warning: warnings.length > 0 ? warnings.join(". ") : undefined };
}

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRow(
  row: string[],
  csvHeaders: string[],
  mapping: HeaderMapping["mapping"],
  schema: ImportSchema,
  seenRows?: Set<string>
): ValidationResult {
  if (row.length !== csvHeaders.length) {
    return {
      status: "warning",
      category: "column_mismatch",
      message: `Expected ${csvHeaders.length} columns, got ${row.length}`,
    };
  }

  if (seenRows) {
    const mappedValues = Object.entries(mapping)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([idx]) => row[Number(idx)] ?? "");
    const rowKey = mappedValues.join("\x1F");
    if (seenRows.has(rowKey)) {
      return {
        status: "warning",
        category: "duplicate_row",
        message: "Duplicate row detected",
        fields: Object.fromEntries(
          Object.entries(mapping).map(([idx, colName]) => [colName, row[Number(idx)] ?? ""])
        ),
      };
    }
    seenRows.add(rowKey);
  }

  const colLookup = new Map<string, string>();
  for (const [idx, colName] of Object.entries(mapping)) {
    colLookup.set(colName, row[Number(idx)] ?? "");
  }

  const emptyFields: Record<string, string> = {};
  for (const col of schema.columns) {
    const value = colLookup.get(col.name);
    if (!value || value.trim() === "") {
      emptyFields[col.name] = "empty";
    }
  }
  if (Object.keys(emptyFields).length > 0) {
    const labels = Object.keys(emptyFields)
      .map((name) => schema.columns.find((c) => c.name === name)?.label ?? name);
    return {
      status: "warning",
      category: "missing_required",
      message: `${labels.map((l) => `"${l}"`).join(", ")} empty`,
      fields: emptyFields,
    };
  }

  for (const col of schema.columns) {
    const value = colLookup.get(col.name);
    if (!value || value.trim() === "") continue;

    switch (col.type) {
      case "number": {
        const cleaned = value.replace(/[$,]/g, "").trim();
        if (isNaN(Number(cleaned))) {
          return {
            status: "warning",
            category: "invalid_number",
            message: `"${value}" is not a valid number (${col.label})`,
            fields: { [col.name]: `"${value}" is not a valid number` },
          };
        }
        break;
      }
      case "email": {
        if (!EMAIL_REGEX.test(value.trim())) {
          return {
            status: "warning",
            category: "invalid_email",
            message: `"${value}" is not a valid email (${col.label})`,
            fields: { [col.name]: `"${value}" is not a valid email` },
          };
        }
        break;
      }
      case "date": {
        const parsed = new Date(value.trim());
        if (isNaN(parsed.getTime())) {
          return {
            status: "warning",
            category: "invalid_date",
            message: `"${value}" is not a valid date (${col.label})`,
            fields: { [col.name]: `"${value}" is not a valid date` },
          };
        }
        break;
      }
    }
  }

  return { status: "valid" };
}

export function rowToSchemaObject(
  row: string[],
  mapping: HeaderMapping["mapping"]
): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [idx, colName] of Object.entries(mapping)) {
    obj[colName] = row[Number(idx)] ?? "";
  }
  return obj;
}
