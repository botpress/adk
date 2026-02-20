export type ImportStatus = "pending" | "parsing" | "validating" | "importing" | "done" | "errored" | "cancelled";

export interface ImportProgressData {
  fileName: string;
  startedAt: string;
  progress: number;
  status: ImportStatus;
  totalRows?: number;
  importedRows?: number;
  skippedRows?: number;
  currentPhase?: string;
  errors?: string[];
  summary?: string;
  pendingQuestion?: string;
  schemaType?: string;
  schemaDisplayName?: string;
}

export type ActivityType = "parsing" | "validating" | "importing" | "resolving" | "done";
export type ActivityStatus = "pending" | "in_progress" | "done" | "error";

export interface ImportActivity {
  id: string;
  type: ActivityType;
  status: ActivityStatus;
  text: string;
  metadata?: string;
}

export interface ImportData {
  fileName: string;
  startedAt: string;
  progress: number;
  status: ImportStatus;
  totalRows?: number;
  importedRows?: number;
  skippedRows?: number;
  currentPhase?: string;
  activities?: ImportActivity[];
  errors?: string[];
  summary?: string;
  pendingQuestion?: string;
  schemaType?: string;
  schemaDisplayName?: string;
}
