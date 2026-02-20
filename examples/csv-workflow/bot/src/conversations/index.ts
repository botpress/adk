import {
  Conversation,
  Autonomous,
  Reference,
  z,
  isWorkflowDataRequest,
} from "@botpress/runtime";
import CsvImportWorkflow from "../workflows";
import {
  createImportProgressComponent,
  updateImportProgressComponent,
} from "../utils/progress";
import { SCHEMAS, detectSchema, SCHEMA_KEYS } from "../utils/schemas";
import { parseCSV } from "../utils/csv-parser";

async function downloadFileContent(fileUrl: string): Promise<string> {
  const _fetch = (globalThis as any).fetch as (...args: any[]) => Promise<any>;
  const response = await _fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

const CANCEL_PATTERN = /\b(cancel|stop|abort)\b/i;
const SCHEMA_PATTERN = /^schema:(\w+)$/;

async function cancelImport(state: any): Promise<void> {
  if (state.importJob) {
    try {
      await (state.importJob as any).cancel();
    } catch {
      // Workflow may already be done
    }

    if (state.messageId) {
      await updateImportProgressComponent(state.messageId, {
        status: "cancelled",
        summary: "Import cancelled by user.",
      });
    }
  }

  state.pendingRequestEvent = undefined;
  state.importJob = undefined;
  state.messageId = undefined;
  state.schemaType = undefined;
}

export default new Conversation({
  channel: "webchat.channel",

  state: z.object({
    messageId: z.string().optional(),
    importJob: Reference.Workflow("csv_import").optional(),
    pendingRequestEvent: z.any().optional(),
    schemaType: z.string().optional(),
  }),

  handler: async ({ execute, conversation, state, message, event, type }) => {
    if (type === "workflow_request" && isWorkflowDataRequest(event)) {
      const question = (event as any).payload?.message ?? "The workflow needs your input.";

      state.pendingRequestEvent = event;

      await conversation.send({ type: "text", payload: { text: question } });

      const qLower = question.toLowerCase();
      let buttons: { label: string; value: string }[] | null = null;

      if (qLower.includes("column mismatch")) {
        buttons = [
          { label: "Pad with N/A", value: "pad with n/a" },
          { label: "Skip rows", value: "skip rows" },
        ];
      } else if (qLower.includes("empty fields")) {
        buttons = [
          { label: "Fill with N/A", value: "fill n/a" },
          { label: "Skip rows", value: "skip rows" },
          { label: "Import as-is", value: "import as-is" },
        ];
      } else if (qLower.includes("duplicate")) {
        buttons = [
          { label: "Remove duplicates", value: "remove duplicates" },
          { label: "Keep all", value: "keep all" },
        ];
      } else if (qLower.includes("invalid number")) {
        buttons = [
          { label: "Set to 0", value: "set to 0" },
          { label: "Skip rows", value: "skip rows" },
          { label: "Import as-is", value: "import as-is" },
        ];
      } else if (qLower.includes("invalid email") || qLower.includes("invalid date")) {
        buttons = [
          { label: "Clear invalid", value: "clear invalid" },
          { label: "Skip rows", value: "skip rows" },
          { label: "Import as-is", value: "import as-is" },
        ];
      } else if (qLower.includes("yes") && qLower.includes("no")) {
        buttons = [
          { label: "Yes, import", value: "yes" },
          { label: "No, cancel", value: "no" },
        ];
      }

      if (buttons) {
        await conversation.send({
          type: "custom",
          payload: {
            name: "action_buttons",
            url: "custom://action_buttons",
            data: { options: buttons },
          },
        } as any);
      }

      return;
    }

    if (type === "message") {
      const userText = (message as any)?.payload?.text ?? (message as any)?.text ?? "";
      const schemaMatch = SCHEMA_PATTERN.exec(userText.trim());

      if (schemaMatch) {
        const schemaKey = schemaMatch[1];
        const schema = SCHEMAS[schemaKey];

        if (!schema) {
          await conversation.send({
            type: "text",
            payload: { text: `Unknown schema "${schemaKey}". Available schemas: ${Object.keys(SCHEMAS).join(", ")}` },
          });
          return;
        }

        state.schemaType = schemaKey;

        const columns = schema.columns
          .map((c) => `${c.label} (${c.type})`)
          .join(", ");

        await conversation.send({
          type: "text",
          payload: {
            text: `**${schema.displayName}** schema selected. Upload a CSV file with these columns:\n\n${columns}`,
          },
        });

        return;
      }
    }

    if (type === "message" && state.importJob) {
      const userText = (message as any)?.payload?.text ?? (message as any)?.text ?? "";

      if (CANCEL_PATTERN.test(userText)) {
        await cancelImport(state);
        await conversation.send({
          type: "text",
          payload: { text: "Import cancelled." },
        });
        return;
      }
    }

    if (type === "message" && state.pendingRequestEvent) {
      const savedEvent = state.pendingRequestEvent;
      state.pendingRequestEvent = undefined;

      const userText = (message as any)?.payload?.text ?? (message as any)?.text ?? "skip";

      try {
        await CsvImportWorkflow.provide(savedEvent as any, { resolution: userText });
      } catch (err: any) {
        await conversation.send({
          type: "text",
          payload: { text: `Failed to send your response to the workflow: ${err.message}` },
        });
      }

      return;
    }

    const msg = message as any;
    const evt = event as any;
    const fileUrl: string =
      msg?.payload?.fileUrl ?? msg?.fileUrl ?? evt?.payload?.fileUrl ?? "";
    const isFileMessage = type === "message" && (msg?.type === "file" || fileUrl);

    if (isFileMessage && fileUrl) {
      try {
        const fileName: string =
          msg?.payload?.title ?? msg?.payload?.fileName ?? msg?.title ?? "upload.csv";

        let csvContent: string;
        try {
          csvContent = await downloadFileContent(fileUrl);
        } catch (err: any) {
          await conversation.send({
            type: "text",
            payload: { text: `Failed to download the file: ${err.message}` },
          });
          return;
        }

        if (!csvContent.trim()) {
          await conversation.send({
            type: "text",
            payload: { text: "The uploaded file appears to be empty. Please upload a valid CSV file." },
          });
          return;
        }

        if (!state.schemaType) {
          try {
            const parsed = parseCSV(csvContent);
            const detected = detectSchema(parsed.headers);
            if (detected) {
              state.schemaType = detected;
            }
          } catch {
            // Let the workflow handle parse errors
          }
        }

        if (!state.schemaType) {
          await conversation.send({
            type: "text",
            payload: { text: "Your CSV doesn't match any of our supported schemas. Download a template below, fill it in, and upload it:" },
          });

          const schemas = SCHEMA_KEYS.map((key) => {
            const s = SCHEMAS[key];
            return {
              key,
              displayName: s.displayName,
              headers: s.columns.map((c) => c.label),
              rows: [] as string[][],
            };
          });

          await conversation.send({
            type: "custom",
            payload: {
              name: "sample_csv_downloads",
              url: "custom://sample_csv_downloads",
              data: { schemas },
            },
          } as any);

          return;
        }

        const progressMsgId = await createImportProgressComponent(conversation, fileName);
        state.messageId = progressMsgId;

        state.importJob = await CsvImportWorkflow.start({
          messageId: progressMsgId,
          conversationId: conversation.id,
          csvContent,
          fileName,
          schemaType: state.schemaType,
        } as any);

        await conversation.send({
          type: "text",
          payload: { text: `Parsing **${fileName}**…` },
        });

        return;
      } catch (err: any) {
        await conversation.send({
          type: "text",
          payload: { text: `Something went wrong starting the import: ${err.message}` },
        });
        return;
      }
    }

    if (state.importJob) {
      const wf = state.importJob as any;

      if (wf.status === "completed") {
        const output = wf.output;
        const imported = output?.importedRows ?? 0;
        const skipped = output?.skippedRows ?? 0;
        const total = output?.totalRows ?? 0;

        let completionMsg = `Done! **${imported}** of **${total}** rows have been imported and saved to the Botpress table.`;
        if (skipped > 0) completionMsg += ` ${skipped} skipped.`;

        await conversation.send({ type: "text", payload: { text: completionMsg } });
        await conversation.send({
          type: "text",
          payload: { text: "To import another file, click **New** in the top right to start a fresh conversation." },
        });

        state.importJob = undefined;
        state.messageId = undefined;
        state.schemaType = undefined;
        return;
      } else if (wf.status === "failed") {
        const errorText = wf.error ?? "unknown error";

        if (state.messageId) {
          await updateImportProgressComponent(state.messageId, {
            status: "errored",
            summary: `Import failed: ${errorText}`,
          });
        }

        await conversation.send({ type: "text", payload: { text: `Import failed: ${errorText}` } });
        await conversation.send({
          type: "text",
          payload: { text: "To try again with a corrected file, click **New** in the top right to start a fresh conversation." },
        });

        state.importJob = undefined;
        state.messageId = undefined;
        state.schemaType = undefined;
        return;
      } else if (wf.status === "timedout") {
        const timeoutMsg = "Import timed out. The operation took too long to complete.";

        if (state.messageId) {
          await updateImportProgressComponent(state.messageId, {
            status: "errored",
            summary: timeoutMsg,
          });
        }

        await conversation.send({ type: "text", payload: { text: timeoutMsg } });
        await conversation.send({
          type: "text",
          payload: { text: "To try again, click **New** in the top right to start a fresh conversation." },
        });
        state.importJob = undefined;
        state.messageId = undefined;
        state.schemaType = undefined;
        return;
      }
    }

    const cancelImportTool = new Autonomous.Tool({
      name: "cancel_import",
      description: "Cancel the currently running CSV import. Use when the user wants to stop or abort the import.",
      input: z.object({}),
      output: z.object({ status: z.string() }),
      handler: async () => {
        await cancelImport(state);
        return { status: "Import cancelled" };
      },
    });

    await execute({
      instructions: `You are a CSV Import Assistant. You help users import CSV data into Botpress tables.

Your capabilities:
- Accept CSV file uploads and run a background import workflow
- Help resolve data issues (duplicates, bad format, missing fields) when the workflow asks
- Allow users to cancel in-progress imports

Behavior:
- When a user sends a text message (not a file), respond conversationally
- If they ask about importing a new file, tell them to click the "New" button in the top right to start a fresh conversation
- If they want to cancel an active import, use the cancel tool
- When an import completes, start with "✅ Import complete — your data has been saved to the Botpress table." as the first line. Then on the next line show the stats (total, imported, skipped). After that, let the user know they can ask any questions or start a new import by clicking the **New** button in the top right corner. Do not use any emojis other than ✅.
- Be concise and helpful`,

      tools: () => {
        const wf = state.importJob as any;
        if (wf && wf.status === "running") {
          return [cancelImportTool];
        }
        return [];
      },
    });
  },
});
