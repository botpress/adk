import { Workflow, z, context, adk } from "@botpress/runtime";
import {
  updateExtractionProgressComponent,
  type ExtractionData,
} from "../utils/progress-component";
import { addActivity, updateActivity } from "../utils/activity-helpers";
import { getPassages } from "../utils/files";
import {
  extractFromBatch,
  type RawClauseWithSource,
} from "../utils/extraction";
import {
  batchPassages,
  getBatchingSummary,
  type PassageBatch,
} from "../utils/passage-batching";
import { EXTRACTION_CONFIG } from "../utils/constants";

const { BATCH_CONCURRENCY, DB_INSERT_BATCH_SIZE } = EXTRACTION_CONFIG;

/**
 * Clause Extraction Workflow
 *
 * Extracts contractual clauses from uploaded documents with:
 * - Smart passage batching (by document sections, max 10 per batch)
 * - Rich progress tracking with passage stats
 * - Parallel batch processing
 */
export default new Workflow({
  name: "extract_clauses",
  timeout: "10m",
  input: z.object({
    conversationId: z.string(),
    userId: z.string(),
    messageId: z.string(),
    fileId: z.string(),
    documentName: z.string(),
    userParty: z.enum(["party_a", "party_b"]).describe("Which party the user represents for risk assessment"),
  }),
  output: z.object({
    contractId: z.number(),
    clauseCount: z.number(),
  }),
  handler: async ({ input, step }) => {
    const { userId, messageId, fileId, documentName, userParty } = input;

    console.info("[WORKFLOW] Starting extract_clauses workflow", {
      userId,
      messageId,
      fileId,
      documentName,
    });

    // Helper to update UI progress
    const updateUI = async (opts: {
      progress: number;
      clausesFound?: number;
      status?: ExtractionData["status"];
      error?: string;
      passageStats?: {
        total: number;
        processed: number;
        skipped: number;
        withClauses: number;
      };
      currentBatch?: {
        index: number;
        total: number;
        sectionHeader?: string;
        passageCount: number;
        pageRange?: { start: number; end: number };
      };
      clauses?: Array<{
        id: number;
        clauseType: string;
        title: string;
        section?: string;
        text: string;
        keyPoints: string[];
        riskLevel: "low" | "medium" | "high";
      }>;
      summary?: string;
    }) => {
      await updateExtractionProgressComponent(messageId, userId, {
        topic: documentName,
        sources: [{ fileId, fileName: documentName }],
        ...opts,
      });
    };

    // ========================================
    // PHASE 1: Create Contract Record and Fetch/Batch Passages
    // ========================================
    const { contractId, batches, batchingStats } = await step(
      "fetch-and-batch",
      async () => {
        console.debug("[WORKFLOW] Phase 1: Fetching and batching passages");

        const readActivityId = await addActivity(
          messageId,
          userId,
          "reading",
          `Waiting for file indexing...`,
          { uniqueKey: "reading" }
        );

        await updateUI({ progress: 5 });

        // Create contract record in database
        const client = context.get("client");
        const { rows } = await client.createTableRows({
          table: "contractsTable",
          rows: [
            {
              userId,
              fileId,
              fileKey: fileId,
              title: documentName,
              status: "analyzing",
              messageId,
            },
          ],
        });

        const contractId = Number(rows[0]?.id);
        if (!contractId) {
          throw new Error("Failed to create contract record");
        }

        // Fetch passages from Files API (with indexing status updates)
        const passages = await getPassages(fileId, {
          onStatusChange: async (status, elapsedSec) => {
            await updateActivity(readActivityId, {
              text: `Indexing: ${status} (${elapsedSec}s elapsed)`,
            });
          },
        });

        if (passages.length === 0) {
          throw new Error(
            "No passages found in document - file may not be indexed"
          );
        }

        // Batch passages by document sections
        const batchingResult = batchPassages(passages);
        const batchingSummary = getBatchingSummary(batchingResult);

        await updateActivity(readActivityId, {
          status: "done",
          text: `Read ${passages.length} passages • ${batchingSummary}`,
        });

        await updateUI({
          progress: 10,
          passageStats: {
            total: batchingResult.stats.totalPassages,
            processed: 0,
            skipped: batchingResult.stats.skippedPassages,
            withClauses: 0,
          },
        });

        console.debug("[WORKFLOW] Phase 1 complete:", {
          contractId,
          totalPassages: passages.length,
          batchCount: batchingResult.batches.length,
          skipped: batchingResult.stats.skippedPassages,
        });

        return {
          contractId,
          batches: batchingResult.batches,
          batchingStats: batchingResult.stats,
        };
      }
    );

    // ========================================
    // PHASE 2: Extract Clauses from Batches (Parallel)
    // ========================================
    let totalClausesFound = 0;
    let processedPassages = 0;

    const rawClauses = await step.map(
      "extract-batch",
      batches,
      async (batch: PassageBatch, { i: batchIndex }) => {
        const batchNum = batchIndex + 1;
        const totalBatches = batches.length;

        console.debug(
          `[WORKFLOW] Extracting batch ${batchNum}/${totalBatches}` +
            (batch.sectionHeader ? ` (${batch.sectionHeader.slice(0, 50)}...)` : "")
        );

        try {
          // Build a meaningful label with fallbacks: section header > page range > batch number
          let batchLabel: string;
          if (batch.sectionHeader) {
            batchLabel = batch.sectionHeader.slice(0, 50);
          } else if (batch.stats.pageRange) {
            const { start, end } = batch.stats.pageRange;
            batchLabel = start === end ? `Page ${start}` : `Pages ${start}-${end}`;
          } else {
            batchLabel = `Batch ${batchNum}/${totalBatches}`;
          }

          const extractActivityId = await addActivity(
            messageId,
            userId,
            "extracting",
            `Analyzing ${batch.passages.length} passages • ${batchLabel}`,
            { contractId, uniqueKey: `extract-batch-${batchIndex}` }
          );

          // Update progress (10-70% range for extraction phase)
          const progressPercent =
            10 + Math.floor((batchIndex / totalBatches) * 60);

          await updateUI({
            progress: progressPercent,
            currentBatch: {
              index: batchNum,
              total: totalBatches,
              sectionHeader: batch.sectionHeader,
              passageCount: batch.passages.length,
              pageRange: batch.stats.pageRange,
            },
            passageStats: {
              total: batchingStats.totalPassages,
              processed: processedPassages,
              skipped: batchingStats.skippedPassages,
              withClauses: totalClausesFound,
            },
          });

          // Extract clauses from this batch (with party context for risk assessment)
          const result = await extractFromBatch(
            batch.passages,
            batch.sectionHeader,
            userParty
          );

          // Update running totals
          processedPassages += batch.passages.length;
          totalClausesFound += result.clauses.length;

          await updateActivity(extractActivityId, {
            status: "done",
            text: `${result.clauses.length} clauses • ${batchLabel}`,
          });

          return result.clauses;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error("[WORKFLOW] Batch extraction failed:", {
            batch: batchNum,
            total: totalBatches,
            passageCount: batch.passages.length,
            error: errorMsg,
          });

          // Log failure to UI activity (using "extracting" type since "warning" isn't defined)
          await addActivity(
            messageId,
            userId,
            "extracting",
            `Batch ${batchNum} failed: ${errorMsg.slice(0, 100)}`,
            { contractId, uniqueKey: `extract-batch-${batchIndex}-error` }
          );

          // Return empty array on error, don't fail entire workflow
          processedPassages += batch.passages.length;
          return [];
        }
      },
      { concurrency: BATCH_CONCURRENCY }
    );

    console.debug("[WORKFLOW] Phase 2 complete, raw clauses:", {
      totalClauses: rawClauses.flat().length,
      batchesProcessed: batches.length,
    });

    // ========================================
    // PHASE 3: Flatten Raw Clauses (no LLM consolidation)
    // ========================================
    // Skip expensive LLM deduplication - section-based batching minimizes duplicates
    const allClauses = rawClauses.flat();

    console.debug("[WORKFLOW] Phase 3: Skipped consolidation, using raw clauses:", {
      totalClauses: allClauses.length,
    });

    await updateUI({
      progress: 75,
      clausesFound: allClauses.length,
      passageStats: {
        total: batchingStats.totalPassages,
        processed: batchingStats.contentPassages,
        skipped: batchingStats.skippedPassages,
        withClauses: totalClausesFound,
      },
    });

    // ========================================
    // PHASE 4: Store Results to Database
    // ========================================
    await step("store-results", async () => {
      console.debug("[WORKFLOW] Phase 4: Storing results");

      const storeActivityId = await addActivity(
        messageId,
        userId,
        "storing",
        `Storing ${allClauses.length} clauses to database`,
        { contractId, uniqueKey: "storing" }
      );

      await updateUI({ progress: 90 });

      const client = context.get("client");

      // Prepare clause rows for insertion (using raw clauses directly)
      const clauseRows = allClauses.map((clause, index) => ({
        userId,
        contractId,
        fileId,
        passageId: clause.passageId, // Single passage (raw clause has passageId, not foundInPassages)
        clauseType: clause.clauseType,
        title: clause.title,
        section: clause.section,
        text: clause.text,
        keyPoints: JSON.stringify(clause.keyPoints),
        riskLevel: clause.riskLevel,
        position: index,
        foundInPassages: JSON.stringify([clause.passageId]), // Wrap single passageId in array for consistency
      }));

      // Batch insert clauses in chunks
      for (let i = 0; i < clauseRows.length; i += DB_INSERT_BATCH_SIZE) {
        const chunk = clauseRows.slice(i, i + DB_INSERT_BATCH_SIZE);
        await client.createTableRows({
          table: "clausesTable",
          rows: chunk,
        });
        console.debug(
          `[WORKFLOW] Stored clauses ${i + 1}-${Math.min(i + DB_INSERT_BATCH_SIZE, clauseRows.length)}`
        );
      }

      // Update contract record with completion status
      await client.updateTableRows({
        table: "contractsTable",
        rows: [
          {
            id: contractId,
            status: "completed",
            clauseCount: allClauses.length,
          },
        ],
      });

      await updateActivity(storeActivityId, {
        status: "done",
        text: `Stored ${allClauses.length} clauses successfully`,
      });

      // Transform raw clauses for frontend display
      const clausesForUI = allClauses.map((clause, index) => ({
        id: index + 1, // Sequential ID for frontend
        clauseType: clause.clauseType,
        title: clause.title,
        section: clause.section,
        text: clause.text,
        keyPoints: clause.keyPoints,
        riskLevel: clause.riskLevel,
      }));

      // Update UI with clauses but not final "done" status yet (summarization pending)
      await updateUI({
        progress: 95,
        clausesFound: allClauses.length,
        clauses: clausesForUI,
      });

      console.debug("[WORKFLOW] Phase 4 complete");
    });

    // ========================================
    // PHASE 5: Generate Contract Summary
    // ========================================
    await step("generate-summary", async () => {
      console.debug("[WORKFLOW] Phase 5: Generating summary");

      const summaryActivityId = await addActivity(
        messageId,
        userId,
        "summarizing",
        "Generating contract summary...",
        { contractId, uniqueKey: "summarizing" }
      );

      // Update UI to show summarizing status
      await updateUI({
        progress: 95,
        status: "summarizing",
      });

      const client = context.get("client");

      // Build clause content for summarization
      const clauseContent = allClauses.map((clause) => {
        const riskLabel = clause.riskLevel === "high" ? "[HIGH RISK] " :
                          clause.riskLevel === "medium" ? "[MEDIUM RISK] " : "";
        return `${riskLabel}${clause.clauseType.toUpperCase()}: ${clause.title}\n${clause.text}\nKey points: ${clause.keyPoints.join("; ")}`;
      }).join("\n\n---\n\n");

      // Use adk.zai.answer to generate summary from clauses
      const result = await adk.zai.answer(
        [clauseContent],
        "Provide a 2-3 sentence executive summary of this contract, highlighting the most important terms, key obligations, and any high-risk clauses that require attention. Focus on: contract type, key parties' obligations, payment terms, notable risks. Be concise but informative - the summary should be scannable in 10 seconds."
      );

      const summary = result.type === "answer" ? result.answer : "";

      // Save summary to contractsTable
      await client.updateTableRows({
        table: "contractsTable",
        rows: [{ id: contractId, summary }],
      });

      await updateActivity(summaryActivityId, {
        status: "done",
        text: summary ? "Contract summary generated" : "Summary generation completed",
      });

      // Final completion activity
      await addActivity(
        messageId,
        userId,
        "complete",
        `Analysis complete: ${allClauses.length} clauses extracted`,
        { uniqueKey: "complete" }
      );

      // Update UI with final status and summary
      await updateUI({
        progress: 100,
        status: "done",
        summary,
      });

      console.debug("[WORKFLOW] Phase 5 complete");
    });

    console.info("[WORKFLOW] Workflow complete!", {
      contractId,
      clauseCount: allClauses.length,
      batchesProcessed: batches.length,
      passagesProcessed: batchingStats.contentPassages,
      passagesSkipped: batchingStats.skippedPassages,
    });

    return {
      contractId,
      clauseCount: allClauses.length,
    };
  },
});
