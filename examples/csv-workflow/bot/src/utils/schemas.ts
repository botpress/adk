export type ColumnType = "string" | "number" | "email" | "date";

export interface SchemaColumn {
  name: string;
  label: string;
  type: ColumnType;
  required: boolean;
}

export interface ImportSchema {
  key: string;
  displayName: string;
  description: string;
  icon: "users" | "package" | "receipt";
  columns: SchemaColumn[];
}

export const SCHEMAS: Record<string, ImportSchema> = {
  employees: {
    key: "employees",
    displayName: "Employees",
    description: "Import employee records with name, email, department, and salary data.",
    icon: "users",
    columns: [
      { name: "name", label: "Name", type: "string", required: true },
      { name: "email", label: "Email", type: "email", required: true },
      { name: "department", label: "Department", type: "string", required: true },
      { name: "salary", label: "Salary", type: "number", required: false },
      { name: "startDate", label: "Start Date", type: "date", required: false },
    ],
  },
  products: {
    key: "products",
    displayName: "Products",
    description: "Import product catalog with SKU, category, pricing, and stock levels.",
    icon: "package",
    columns: [
      { name: "productName", label: "Product Name", type: "string", required: true },
      { name: "sku", label: "SKU", type: "string", required: true },
      { name: "category", label: "Category", type: "string", required: true },
      { name: "price", label: "Price", type: "number", required: true },
      { name: "stockQuantity", label: "Stock Quantity", type: "number", required: false },
    ],
  },
  transactions: {
    key: "transactions",
    displayName: "Transactions",
    description: "Import financial transactions with date, amount, category, and payment method.",
    icon: "receipt",
    columns: [
      { name: "transactionDate", label: "Transaction Date", type: "date", required: true },
      { name: "description", label: "Description", type: "string", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "category", label: "Category", type: "string", required: true },
      { name: "paymentMethod", label: "Payment Method", type: "string", required: false },
    ],
  },
};

export const SCHEMA_KEYS = ["employees", "products", "transactions"] as const;

/** Normalize header for fuzzy matching: "stock_quantity" / "Stock Quantity" / "StockQuantity" → "stockquantity" */
export function normalizeHeader(header: string): string {
  return header.replace(/[_\s-]/g, "").toLowerCase();
}

export interface HeaderMapping {
  mapping: Record<number, string>;
  missing: string[];
  extra: string[];
}

export function mapHeaders(csvHeaders: string[], schema: ImportSchema): HeaderMapping {
  const mapping: Record<number, string> = {};
  const matched = new Set<string>();

  for (let i = 0; i < csvHeaders.length; i++) {
    const normalizedCsv = normalizeHeader(csvHeaders[i]);
    for (const col of schema.columns) {
      if (matched.has(col.name)) continue;
      if (normalizeHeader(col.name) === normalizedCsv || normalizeHeader(col.label) === normalizedCsv) {
        mapping[i] = col.name;
        matched.add(col.name);
        break;
      }
    }
  }

  const missing = schema.columns
    .filter((c) => !matched.has(c.name))
    .map((c) => c.label);

  const extra = csvHeaders.filter((_, i) => !(i in mapping));

  return { mapping, missing, extra };
}

export function detectSchema(csvHeaders: string[]): string | null {
  let bestKey: string | null = null;
  let bestScore = 0;

  for (const [key, schema] of Object.entries(SCHEMAS)) {
    const result = mapHeaders(csvHeaders, schema);
    const matchedCount = Object.keys(result.mapping).length;

    // All required columns must be present
    const missingRequired = schema.columns.filter(
      (c) => c.required && !Object.values(result.mapping).includes(c.name)
    );
    if (missingRequired.length > 0) continue;

    // Require at least 2 column matches to avoid false positives
    if (matchedCount >= 2 && matchedCount > bestScore) {
      bestScore = matchedCount;
      bestKey = key;
    }
  }

  return bestKey;
}
