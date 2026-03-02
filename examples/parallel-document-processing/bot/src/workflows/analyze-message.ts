import { Workflow, z, adk } from "@botpress/runtime";

export const CheckResultSchema = z.object({
  check: z.string().describe("The yes/no question that was evaluated"),
  passed: z
    .boolean()
    .describe("Whether the check passed (true) or failed (false)"),
  explanation: z
    .string()
    .describe("Brief explanation of why the check passed or failed"),
});

export type CheckResult = z.infer<typeof CheckResultSchema>;

/**
 * A single-dimension document analysis workflow.
 *
 * Takes a title and free-form instructions, converts the instructions into
 * concrete yes/no checks, pauses via step.request() so the user can review
 * and refine the checks, then runs the approved checks against the PDF text.
 */
export const AnalyzeDocumentWorkflow = new Workflow({
  name: "analyze_document",
  input: z.object({
    fileContent: z
      .string()
      .describe("Extracted text content of the uploaded PDF"),
    title: z.string().describe("Name of this analysis dimension"),
    id: z.string().describe("The ID of the workflow"),
    instructions: z
      .string()
      .describe("Free-form criteria that get converted into yes/no checks"),
  }),
  requests: {
    // Schema for the data the conversation handler will provide back
    checks: z.object({
      checks: z
        .array(z.string())
        .describe("The approved or modified list of yes/no check questions"),
    }),
  },
  output: z.object({
    id: z.string().describe("The id of this workflow"),
    title: z.string(),
    results: z.array(CheckResultSchema),
  }),
  handler: async ({ input, step, client }) => {
    // ============================================================
    // STEP 1: Convert free-form instructions into yes/no checks
    // ============================================================
    const generated = await step("generate-checks", async () => {
      return await adk.zai.extract(
        `You are preparing a document analysis for the dimension: "${input.title}".

Instructions: ${input.instructions}

Generate exactly 3-5 specific, answerable yes/no check questions that an analyst would use to evaluate a document for this dimension. Each check must be phrased as a yes/no question that can be definitively answered by reading the document.`,
        z.object({
          checks: z
            .array(z.string())
            .describe("3-5 yes/no check questions for this analysis dimension"),
        }),
      );
    });

    // ============================================================
    // STEP 2: Pause and let the user review / refine the checks
    // step.request() emits a workflowDataRequest event to the conversation.
    // The conversation handler uses execute() to gather feedback from the
    // user, then calls request.workflow.provide('checks', { checks }) to
    // resume this workflow with the final list.
    // ============================================================
    const { checks } = await step.request(
      "checks",
      `${JSON.stringify({ id: input.id, checks: generated.checks })}`,
    );

    // ============================================================
    // STEP 3: Run the approved checks against the document
    // ============================================================
    const results = await step("run-checks", async () => {
      const checkResults: Array<CheckResult> = [];

      for (const check of checks) {
        const { output } = await adk.zai
          .check(input.fileContent, check)
          .result();
        checkResults.push({
          check,
          passed: output.value,
          explanation: output.explanation,
        });
      }

      return checkResults;
    });

    return { title: input.title, id: input.id, results };
  },
});
