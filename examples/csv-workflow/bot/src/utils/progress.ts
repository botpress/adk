import { context } from "@botpress/runtime";

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

export async function createImportProgressComponent(
  conversation: any,
  fileName: string
): Promise<string> {
  const initialData: ImportProgressData = {
    fileName,
    startedAt: new Date().toISOString(),
    progress: 0,
    status: "pending",
  };

  const result = await conversation.send({
    type: "custom",
    payload: {
      name: "csv_import_progress",
      url: "custom://csv_import_progress",
      data: initialData,
    },
  });

  return (result as any)?.id ?? (result as any)?.message?.id ?? "";
}

const TERMINAL_STATES: ImportStatus[] = ["done", "errored", "cancelled"];

export async function updateImportProgressComponent(
  messageId: string,
  updates: Partial<ImportProgressData>
): Promise<void> {
  try {
    const client = context.get("client");

    const existing = await (client as any).getMessage({ id: messageId });
    const currentData = ((existing as any).payload ?? (existing as any).message?.payload)?.data as
      | ImportProgressData
      | undefined;

    if (currentData && TERMINAL_STATES.includes(currentData.status)) {
      return;
    }

    const merged: ImportProgressData = {
      ...(currentData ?? { fileName: "", startedAt: new Date().toISOString(), progress: 0, status: "pending" }),
      ...updates,
      progress: Math.max(currentData?.progress ?? 0, updates.progress ?? 0),
      pendingQuestion: updates.pendingQuestion ?? undefined,
    };

    await (client as any).updateMessage({
      id: messageId,
      tags: {},
      payload: {
        name: "csv_import_progress",
        url: "custom://csv_import_progress",
        data: merged,
      },
    });
  } catch {
    // Progress updates are best-effort
  }
}
