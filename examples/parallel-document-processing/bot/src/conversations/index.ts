import {
  Conversation,
  z,
  isWorkflowCallback,
  Reference,
} from "@botpress/runtime";
import { extractText } from "unpdf";
import { AnalyzeDocumentWorkflow } from "../workflows/analyze-message";
import axios from "axios";
/**
 * Fetch a PDF from a URL and extract its text content.
 */
async function extractPdfText(url: string): Promise<string> {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const { text } = await extractText(new Uint8Array(response.data), {
    mergePages: true,
  });
  return text.trim();
}

/**
 * Conversation handler — the user-facing layer.
 *
 * Handles three event types:
 *
 * 1. workflow_callback
 *    The orchestrator workflow completed (or failed). The callback fires
 *    automatically — no polling or state tracking needed. We format and
 *    send the aggregated results.
 *
 * 2. workflow_request (analyze_document:checks)
 *    A sub-workflow has generated yes/no checks and is paused waiting for
 *    user feedback. We use execute() to let the LLM have a natural
 *    conversation with the user, then resume the workflow via
 *    request.workflow.provide().
 *
 * 3. message (PDF upload)
 *    The user uploaded a PDF. Extract text and start the orchestrator.
 */
export default new Conversation({
  channel: ["webchat.channel"],
  events: ["webchat:trigger", "upsertAnalyzer"],
  state: z
    .object({
      analyzers: z.record(
        z.string(),
        z.object({
          name: z.string(),
          instructions: z.string(),
          workflow: Reference.Workflow("analyze_document").optional(),
        }),
      ),
    })
    .default({
      analyzers: {},
    }),
  handler: async ({
    type,
    event,
    message,
    request,
    conversation,
    state,
    workflow,
  }) => {
    if (!state.analyzers) {
      state.analyzers = {};
    }
    // ============================================================
    // CASE 1: A custom event to upsert an analyzer in the state map.
    // The frontend sends a webchat:trigger event with payload
    // { type: "upsertAnalyzer", id, name, instructions }
    // ============================================================
    if (
      type === "event" &&
      event.type === "webchat:trigger" &&
      event.payload.payload.type === "upsertAnalyzer"
    ) {
      const { id, name, instructions } = event.payload.payload as {
        id: string;
        name: string;
        instructions: string;
      };
      state.analyzers[id] = { name, instructions, workflow: undefined };
      return;
    }

    // ============================================================
    // CASE 2: The user uploaded a PDF — start a fresh analysis.
    // A workflow will be started for each analyzer in the state.
    // ============================================================
    const isFileMessage =
      message?.type === "file" && message?.payload.fileUrl.endsWith("pdf");

    if (isFileMessage) {
      const payload = message?.payload;

      const analyzerEntries = Object.entries(state.analyzers);
      if (analyzerEntries.length === 0) {
        await conversation.send({
          type: "text",
          payload: {
            text: "⚠️ No analyzers configured. Please add at least one analyzer before uploading a PDF.",
          },
        });
        return;
      }

      let fileContent: string;
      try {
        fileContent = await extractPdfText(payload.fileUrl);
      } catch {
        await conversation.send({
          type: "text",
          payload: {
            text: "⚠️ I couldn't read that PDF. Please make sure it's a text-based PDF (not a scanned image) and try again.",
          },
        });
        return;
      }

      if (!fileContent) {
        await conversation.send({
          type: "text",
          payload: {
            text: "⚠️ The PDF appears to be empty or contains only images. Please upload a text-based PDF.",
          },
        });
        return;
      }

      for (const [id, analyzer] of analyzerEntries) {
        const wf = await AnalyzeDocumentWorkflow.getOrCreate({
          key: id,
          input: {
            fileContent,
            title: analyzer.name,
            id,
            instructions: analyzer.instructions,
          },
        });
        state.analyzers[id].workflow = wf;
      }
      return;
    }

    // ============================================================
    // CASE 3: An analyzer is paused waiting for user feedback on checks.
    // step.request('checks', ...) inside AnalyzeDocumentWorkflow fired a
    // workflowDataRequest event.
    // ============================================================
    if (
      type === "workflow_request" &&
      request?.type === "analyze_document:checks"
    ) {
      // Search the state map and set the corresponding analyzer's workflow
      if (request.workflow.key && state.analyzers[request.workflow.key]) {
        state.analyzers[request.workflow.key].workflow = request.workflow;
      }

      const message =
        event && (event as { payload: { message: string } }).payload.message; // fix ADK typing here

      console.log(message);

      const typedMessage = `Workflow Request\n` + message;
      await conversation.send({
        type: "text",
        payload: {
          text: typedMessage,
        },
      });

      return;
    }

    // ============================================================
    // CASE 4: A custom event to provide the requesting analyzer
    // with the updated checks. The frontend sends a webchat:trigger
    // event with payload
    // { type: "confirmAnalysis", checks }
    // ============================================================
    if (
      type === "event" &&
      event.type === "webchat:trigger" &&
      event.payload.payload.type === "confirmAnalysis"
    ) {
      const { id, checks } = event.payload.payload as {
        id: string;
        checks: string[];
      };
      console.log("sending back to workflow:", id, checks)
      await state.analyzers[id].workflow?.provide("checks", { checks });
      return;
    }

    // ============================================================
    // CASE 5: The orchestrator workflow finished — deliver results.
    // The workflow_callback event fires automatically when a workflow
    // that was started from this conversation completes/fails/times out.
    // ============================================================
    if (isWorkflowCallback(event)) {
      const { status, output } = event.payload;
      if (status === "completed" && output) {
        const typedMessage =
          `Workflow Completion\nSuccess\n` + JSON.stringify(output);
        await conversation.send({
          type: "text",
          payload: { text: typedMessage },
        });
      } else {
        const analyzerId = output?.id ?? "unknown";
        await conversation.send({
          type: "text",
          payload: {
            text: `Workflow Failure\n${JSON.stringify({ id: analyzerId })}`,
          },
        });
      }
      return;
    }

    // ============================================================
    // FALLBACK: Non-PDF text message — guide the user.
    // ============================================================
    if (message?.type === "text" && message?.payload?.text) {
      await conversation.send({
        type: "text",
        payload: {
          text: "👋 Upload a PDF to get started. I'll generate yes/no checks across three dimensions (Clarity, Completeness, and Accuracy), show them to you for approval, then run the analysis.",
        },
      });
    }
  },
});
