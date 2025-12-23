import { Autonomous, z, adk } from "@botpress/runtime";
import type { Client } from "@botpress/client";
import { ClauseTypeEnum, RiskLevelEnum } from "../utils/constants";

/**
 * Clause schema used by tools
 */
export const ClauseToolSchema = z.object({
  id: z.number(),
  title: z.string(),
  clauseType: z.string(),
  riskLevel: z.string(),
  text: z.string(),
  keyPoints: z.array(z.string()),
});

export type ClauseToolData = z.infer<typeof ClauseToolSchema>;

/**
 * Creates a query_clauses tool for searching extracted clauses
 */
export function createQueryClausesTool(client: Client, userId: string) {
  return new Autonomous.Tool({
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
      clauses: z.array(ClauseToolSchema),
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
}

/**
 * Creates a summarize_clauses tool for analyzing clauses
 */
export function createSummarizeClausesTool() {
  return new Autonomous.Tool({
    name: "summarize_clauses",
    description:
      "Analyze clauses and answer questions about them. Use after query_clauses to provide insights, risk analysis, comparisons, or recommendations. Pass the clauses from query_clauses output.",
    input: z.object({
      question: z
        .string()
        .describe("The question or analysis request about the clauses"),
      clauses: z
        .array(ClauseToolSchema)
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
}

/**
 * Creates an update_contract_summary tool for saving summaries
 */
export function createUpdateContractSummaryTool(client: Client, contractId: number) {
  return new Autonomous.Tool({
    name: "update_contract_summary",
    description: "Save the generated summary to the contract record. Call this once you have a complete summary.",
    input: z.object({
      summary: z.string().describe("The contract summary text (2-3 sentences, executive overview)"),
    }),
    output: z.object({ success: z.boolean() }),
    handler: async ({ summary }) => {
      console.debug("[TOOL] update_contract_summary called", { contractId, summaryLength: summary.length });

      await client.updateTableRows({
        table: "contractsTable",
        rows: [{ id: contractId, summary }],
      });

      return { success: true };
    },
  });
}
