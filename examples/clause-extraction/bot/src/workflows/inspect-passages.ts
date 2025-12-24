import { Workflow, z } from "@botpress/runtime";
import { getPassages } from "../utils/files";

/**
 * Investigation Workflow: Inspect Passages
 *
 * Utility workflow to inspect passage data from the Files API.
 * Useful for understanding what metadata is available on passages
 * before implementing features that depend on it.
 *
 * This workflow demonstrates:
 * - How to create a workflow with typed input/output schemas
 * - How to call the Files API to retrieve passages
 * - How to use workflow steps for durable execution
 *
 * Trigger via MCP:
 *   adk_start_workflow({
 *     workflow: "inspect_passages",
 *     payload: { fileId: "file_xxx", limit: 10 }
 *   })
 *
 * Or via the ADK CLI:
 *   adk workflow inspect_passages --input '{"fileId": "file_xxx"}'
 */
export default new Workflow({
  name: "inspect_passages",
  timeout: "2m",
  input: z.object({
    fileId: z.string().describe("File ID to inspect passages from"),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Max passages to return in sample"),
  }),
  output: z.object({
    totalPassages: z.number(),
    samplePassages: z.array(
      z.object({
        id: z.string(),
        contentPreview: z.string(),
        contentLength: z.number(),
        metadata: z.record(z.unknown()).optional(),
      })
    ),
    metadataFields: z
      .array(z.string())
      .describe("Unique metadata keys found across all passages"),
    metadataStats: z.record(z.number()).describe("Count of passages with each metadata key"),
  }),
  handler: async ({ input, step }) => {
    const { fileId, limit } = input;

    console.info(`[INSPECT] Fetching passages for file: ${fileId}`);

    const passages = await step("fetch-passages", async () => {
      return getPassages(fileId);
    });

    console.info(`[INSPECT] Found ${passages.length} passages`);

    // Collect all unique metadata keys and count occurrences
    const metadataKeys = new Set<string>();
    const metadataStats: Record<string, number> = {};

    passages.forEach((p) => {
      if (p.metadata) {
        Object.keys(p.metadata).forEach((k) => {
          metadataKeys.add(k);
          metadataStats[k] = (metadataStats[k] || 0) + 1;
        });
      }
    });

    // Sample passages for inspection
    const samplePassages = passages.slice(0, limit).map((p) => ({
      id: p.id,
      contentPreview:
        p.content.slice(0, 300) + (p.content.length > 300 ? "..." : ""),
      contentLength: p.content.length,
      metadata: p.metadata as Record<string, unknown> | undefined,
    }));

    console.info("[INSPECT] Passage inspection results:", {
      totalPassages: passages.length,
      sampleCount: samplePassages.length,
      metadataFields: Array.from(metadataKeys),
      metadataStats,
    });

    // Log detailed sample for debugging
    console.debug("[INSPECT] Sample passages:", JSON.stringify(samplePassages, null, 2));

    return {
      totalPassages: passages.length,
      samplePassages,
      metadataFields: Array.from(metadataKeys),
      metadataStats,
    };
  },
});
