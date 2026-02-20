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
