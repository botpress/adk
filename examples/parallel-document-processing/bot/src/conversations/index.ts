import {
  Conversation,
  z,
  isWorkflowCallback,
  Reference,
} from "@botpress/runtime";
import axios from "axios";
import { getFileText } from "../utils/files";
import { AnalyzeDocumentWorkflow } from "../workflows/analyze-message";

/**
 * Conversation handler — the user-facing layer.
 *
 * Handles five event types:
 * 1. upsertAnalyzer
 *    Event sent from the frontend to add an analyzer to the conversation
 *    state.
 *
 * 2. message (file upload)
 *    The user uploaded a file. Upload it via the Files API with indexing,
 *    extract text from passages, and start the orchestrator.
 *
 * 3. workflow_request (analyze_document:checks)
 *    A sub-workflow has generated yes/no checks and is paused waiting for
 *    user feedback. We esume the workflow via request.workflow.provide().
 *
 * 4. confirmAnalysis
 *    Event sent from the frontend to confirm the dimensions to analyze a
 *    document on.
 *
 * 5. workflow_callback
 *    The orchestrator workflow completed (or failed). The callback fires
 *    automatically — no polling or state tracking needed. We format and
 *    send the aggregated results.
 *
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
    client,
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
    // CASE 2: The user uploaded a file — start a fresh analysis.
    // A workflow will be started for each analyzer in the state.
    // ============================================================
    const isFileMessage = message?.type === "file";

    if (isFileMessage) {
      const payload = message?.payload;

      const analyzerEntries = Object.entries(state.analyzers);
      if (analyzerEntries.length === 0) {
        await conversation.send({
          type: "text",
          payload: {
            text: "⚠️ No analyzers configured. Please add at least one analyzer before uploading a document.",
          },
        });
        return;
      }

      let fileContent: string;
      try {
        const res = await axios.get(payload.fileUrl, {
          responseType: "arraybuffer",
        });
        const content = new Uint8Array(res.data);
        const contentType =
          (res.headers["content-type"] as string) || "application/octet-stream";
        const { file } = await client.uploadFile({
          key: `user-upload-${conversation.id}/${Date.now()}-${payload.title}`,
          content,
          contentType,
          index: true,
          expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        });

        fileContent = await getFileText(file.id);
      } catch (error) {
        console.log(JSON.stringify(error));
        await conversation.send({
          type: "text",
          payload: {
            text: "⚠️ I couldn't process that file. Please try again with a different document.",
          },
        });
        return;
      }

      if (!fileContent) {
        await conversation.send({
          type: "text",
          payload: {
            text: "⚠️ The document appears to be empty or couldn't be indexed. Please try a different file.",
          },
        });
        return;
      }

      await Promise.all(
        analyzerEntries.map(async ([id, analyzer]) => {
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
        }),
      );
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
      console.log("sending back to workflow:", id, checks);
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
    // FALLBACK: Non-file text message — guide the user.
    // ============================================================
    if (message?.type === "text" && message?.payload?.text) {
      await conversation.send({
        type: "text",
        payload: {
          text: "👋 Upload a document to get started. I'll generate yes/no checks across three dimensions (Clarity, Completeness, and Accuracy), show them to you for approval, then run the analysis.",
        },
      });
    }
  },
});
