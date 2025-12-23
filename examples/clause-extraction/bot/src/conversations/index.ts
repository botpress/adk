import { Conversation, z, Autonomous, Reference, adk } from "@botpress/runtime";
import ExtractClausesWorkflow from "../workflows/extract-clauses";
import { createExtractionProgressComponent } from "../utils/progress-component";
import { processFileMessage } from "../utils/file-upload";
import { ClauseTypeEnum, RiskLevelEnum } from "../utils/constants";

/**
 * Main conversation handler for clause extraction bot
 */
export default new Conversation({
  channel: ["webchat.channel"],
  state: z.object({
    messageId: z.string().optional(),
    extraction: Reference.Workflow("extract_clauses").optional(),
    // Which party the user represents (for risk assessment perspective)
    userParty: z.enum(["party_a", "party_b"]).optional(),
    // Track all uploaded files (persists across workflow failures)
    uploadedFiles: z
      .array(
        z.object({
          fileId: z.string(),
          fileName: z.string(),
          source: z.enum(["files-api", "webchat-reupload"]),
          uploadedAt: z.string(),
        })
      )
      .default([]),
  }),
  handler: async ({ execute, message, conversation, state, client }) => {
    // Get userId - webchat provides via tag, fallback to conversation.id
    const userId =
      (conversation.tags?.["webchat:userId"] as string) || conversation.id;

    // Initialize uploadedFiles array if not present (migration from old schema)
    if (!state.uploadedFiles) {
      state.uploadedFiles = [];
    }

    console.debug("[CONVERSATION] Handler invoked", {
      userId,
      messageType: message?.type,
      hasExtraction: !!state.extraction,
      uploadedFilesCount: state.uploadedFiles.length,
    });

    // Handle file uploads - add to array (persists across failures)
    // Supports both direct "file" messages and "bloc" messages containing files
    if (message?.type === "file" || message?.type === "bloc") {
      try {
        const processed = await processFileMessage(client, message);
        if (processed) {
          state.uploadedFiles.push({
            ...processed,
            uploadedAt: new Date().toISOString(),
          });
          console.info("[FILE] Added to uploadedFiles array:", {
            fileId: processed.fileId,
            fileName: processed.fileName,
            totalFiles: state.uploadedFiles.length,
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("[FILE] Processing failed:", { error: errorMsg });

        // Notify user of upload failure
        await conversation.send({
          type: "text",
          payload: {
            text: `I couldn't process your file upload. ${errorMsg.includes("unsupported") ? "Please try a PDF or text document." : "Please try again."}`,
          },
        });
      }
    }

    // Get the most recent uploaded file
    const latestFile = state.uploadedFiles.at(-1);

    // Tool: Analyze Contract
    const analyzeContractTool = new Autonomous.Tool({
      name: "analyze_contract",
      description:
        "Start analyzing the uploaded contract document to extract and assess all contractual clauses. You MUST ask the user which party they represent before calling this tool, as risk assessment depends on their perspective.",
      input: z.object({
        userParty: z
          .enum(["party_a", "party_b"])
          .describe("Which party the user represents: party_a (typically the service provider/vendor) or party_b (typically the client/customer). REQUIRED - ask the user first."),
        documentName: z
          .string()
          .optional()
          .describe("Optional custom name for the document (defaults to uploaded file name)"),
      }),
      output: z.object({
        success: z.boolean(),
        message: z.string(),
      }),
      handler: async ({ userParty, documentName }) => {
        // Use the most recent uploaded file from state
        if (!latestFile) {
          return {
            success: false,
            message: "No file has been uploaded. Please upload a contract document first.",
          };
        }

        const fileId = latestFile.fileId;
        const finalDocName = documentName || latestFile.fileName;

        // Store party selection in state
        state.userParty = userParty;

        console.debug("[TOOL] analyze_contract called", {
          fileId,
          documentName: finalDocName,
          userParty,
        });

        // Create initial progress message
        const progressMsg = await createExtractionProgressComponent({
          progress: 0,
          status: "in_progress",
          topic: finalDocName,
          clausesFound: 0,
          sources: [{ fileId, fileName: finalDocName }],
          activities: [],
        });

        console.debug("[TOOL] Created progress message:", progressMsg.id);

        // Start the extraction workflow with party context
        const workflowInstance = await ExtractClausesWorkflow.start({
          conversationId: conversation.id,
          userId,
          messageId: progressMsg.id,
          fileId,
          documentName: finalDocName,
          userParty,
        });

        console.info("[TOOL] Started workflow:", workflowInstance.id);

        // Store workflow reference and message ID in state
        state.extraction = workflowInstance;
        state.messageId = progressMsg.id;

        const partyLabel = userParty === "party_a" ? "Party A (service provider)" : "Party B (client)";
        return {
          success: true,
          message: `Started extracting clauses from ${finalDocName}. Risk will be assessed from your perspective as ${partyLabel}. I'll update you as I progress through the document.`,
        };
      },
    });

    // Tool: Query Clauses
    const queryClausesTool = new Autonomous.Tool({
      name: "query_clauses",
      description:
        "Search extracted clauses by clause type, risk level, IDs, or text content. Use this after a contract has been analyzed.",
      input: z.object({
        clauseIds: z
          .array(z.number())
          .optional()
          .describe("Filter to specific clause IDs"),
        contractId: z
          .number()
          .optional()
          .describe("Contract ID to search within (if known)"),
        clauseType: ClauseTypeEnum.optional().describe("Filter by clause type"),
        riskLevel: RiskLevelEnum.optional().describe("Filter by risk level"),
        searchText: z
          .string()
          .optional()
          .describe("Search for text content in clauses"),
      }),
      output: z.object({
        clauses: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
            clauseType: z.string(),
            riskLevel: z.string(),
            text: z.string(),
            keyPoints: z.array(z.string()),
          })
        ),
        count: z.number(),
      }),
      handler: async ({ clauseIds, contractId, clauseType, riskLevel, searchText }) => {
        console.debug("[TOOL] query_clauses called", {
          userId,
          clauseIds,
          contractId,
          clauseType,
          riskLevel,
          searchText,
        });

        // Build filter - ALWAYS include userId for security (LLM cannot override)
        const filter: Record<string, unknown> = {
          userId: { $eq: userId }, // MANDATORY: scope to current user
        };

        if (clauseIds && clauseIds.length > 0) {
          filter.id = { $in: clauseIds };
        }

        if (contractId) {
          filter.contractId = { $eq: contractId };
        }

        if (clauseType) {
          filter.clauseType = { $eq: clauseType };
        }

        if (riskLevel) {
          filter.riskLevel = { $eq: riskLevel };
        }

        // Execute search
        const { rows } = await client.findTableRows({
          table: "clausesTable",
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          search: searchText,
          limit: 50,
          orderBy: "position",
          orderDirection: "asc",
        });

        // Parse and format results
        const clauses = rows.map((row) => ({
          id: Number(row.id),
          title: row.title.toString(),
          clauseType: row.clauseType.toString(),
          riskLevel: row.riskLevel.toString(),
          text: row.text.toString(),
          keyPoints: JSON.parse(row.keyPoints.toString()),
        }));

        console.debug("[TOOL] Found clauses:", clauses.length);

        return {
          clauses,
          count: clauses.length,
        };
      },
    });

    // Tool: Check Extraction Status
    const checkStatusTool = new Autonomous.Tool({
      name: "check_extraction_status",
      description: "Check the status of the current extraction workflow",
      input: z.object({}),
      output: z.object({
        status: z.string(),
        progress: z.string(),
      }),
      handler: async () => {
        if (!state.extraction) {
          return {
            status: "No extraction in progress",
            progress: "0%",
          };
        }

        const status = state.extraction.status;
        let progress = "Unknown";

        if (status === "completed" && state.extraction.output) {
          progress = `100% - Found ${state.extraction.output.clauseCount} clauses`;
        } else if (status === "running") {
          progress = "In progress...";
        } else if (status === "failed") {
          progress = "Failed";
        }

        return {
          status,
          progress,
        };
      },
    });

    // Tool: Summarize/Analyze Clauses
    const summarizeClausesTool = new Autonomous.Tool({
      name: "summarize_clauses",
      description:
        "Analyze clauses and answer questions about them. Use after query_clauses to provide insights, risk analysis, comparisons, or recommendations. Pass the clauses from query_clauses output.",
      input: z.object({
        question: z
          .string()
          .describe("The question or analysis request about the clauses"),
        clauses: z
          .array(
            z.object({
              id: z.number(),
              title: z.string(),
              clauseType: z.string(),
              riskLevel: z.string(),
              text: z.string(),
              keyPoints: z.array(z.string()),
            })
          )
          .describe("Clauses from query_clauses output to analyze"),
      }),
      output: z.object({
        answer: z.string(),
        type: z.enum([
          "answer",
          "ambiguous",
          "out_of_topic",
          "invalid_question",
          "missing_knowledge",
        ]),
        followUp: z.string().optional(),
        citedClauseIds: z.array(z.number()),
      }),
      handler: async ({ question, clauses }) => {
        console.debug("[TOOL] summarize_clauses called", {
          question,
          clauseCount: clauses.length,
        });

        if (clauses.length === 0) {
          return {
            answer: "No clauses provided to analyze.",
            type: "missing_knowledge" as const,
            citedClauseIds: [],
          };
        }

        const result = await adk.zai.answer(clauses, question, {
          instructions: `You are a contract analysis expert reviewing extracted contract clauses.
Provide clear, actionable insights about the clauses.
When discussing risk, explain the implications and recommend specific actions.
Use markdown formatting (headings, bullets) for readability.
Always reference specific clauses when making claims.`,
        });

        if (result.type === "answer") {
          return {
            answer: result.answer,
            type: "answer" as const,
            citedClauseIds: result.citations.map((c) => c.item.id),
          };
        } else if (result.type === "ambiguous") {
          return {
            answer: result.answers[0]?.answer || "The question is ambiguous.",
            type: "ambiguous" as const,
            followUp: result.follow_up,
            citedClauseIds: [],
          };
        } else {
          return {
            answer: result.reason,
            type: result.type,
            citedClauseIds: [],
          };
        }
      },
    });

    // Conditional tools based on whether extraction is running
    const tools = () => {
      const baseTools = [queryClausesTool, summarizeClausesTool, checkStatusTool];
      if (state.extraction && state.extraction.status === "running") {
        // During extraction, allow querying/summarizing but not starting new extraction
        return baseTools;
      } else {
        // When no extraction running, allow starting new extraction
        return [analyzeContractTool, ...baseTools];
      }
    };

    // Build dynamic instructions based on state
    const buildInstructions = () => {
      let instructions = `You are a contract clause extraction assistant. You help users analyze legal contracts to extract, categorize, and assess risk in contractual clauses.

## IMPORTANT: Party Selection

Before analyzing any contract, you MUST ask the user which party they represent:
- **Party A**: Typically the service provider, vendor, or seller
- **Party B**: Typically the client, customer, or buyer

Risk assessment is subjective - a clause favorable to one party may be risky for the other. Knowing which party the user represents ensures accurate risk assessment from their perspective.

When a user uploads a contract document:
1. ASK which party they represent (Party A or Party B)
2. Once they answer, use the analyze_contract tool with their party selection
3. The extraction will process automatically in the background
4. Once complete, you can answer questions about the clauses

## Tool Usage

**query_clauses**: Retrieve and filter clauses from the database
- Filter by clause type, risk level, specific IDs, or text search
- Returns clause data including text, key points, and risk level

**summarize_clauses**: Analyze clauses and answer questions
- Use AFTER query_clauses to provide insights, analysis, or recommendations
- Pass the clauses from query_clauses output directly to this tool
- Returns well-formatted markdown analysis with cited clause references

## Workflow Examples

1. "What high-risk clauses should I worry about?"
   → First: query_clauses(riskLevel: "high")
   → Then: summarize_clauses(question: "What risks do these clauses present?", clauses: <results>)

2. "List all payment terms"
   → Just: query_clauses(clauseType: "payment_terms") and present the results directly`;

      // Add context about uploaded file
      if (latestFile && !state.userParty) {
        instructions += `

IMPORTANT: The user has uploaded a contract file: "${latestFile.fileName}"

Before starting analysis, you MUST ask: "Which party do you represent in this contract? Are you Party A (the service provider/vendor) or Party B (the client/customer)?"

Once they answer, call analyze_contract with their party selection.`;
      } else if (latestFile && state.userParty) {
        const partyLabel = state.userParty === "party_a" ? "Party A (service provider)" : "Party B (client)";
        instructions += `

The user has uploaded "${latestFile.fileName}" and identified as ${partyLabel}. You can now call analyze_contract to start extraction.`;
      }

      return instructions;
    };

    // Execute autonomous loop
    await execute({
      instructions: buildInstructions(),
      tools: tools(),
    });
  },
});
