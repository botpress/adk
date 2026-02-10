import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

// ============================================
// Finance Tools
// ============================================
// All tool handlers return hardcoded mock data — in a real agent these would
// call a finance system API. The schemas are what matter: they define the contract
// the AI uses to decide which tool to call and how to present the result.

const getExpenseReport = new Tool({
  name: "getExpenseReport",
  description: "Get expense report for an employee",
  input: z.object({
    employeeId: z.string().describe("Employee ID"),
    month: z.string().describe("Month (YYYY-MM)"),
  }),
  output: z.object({
    total: z.number(),
    items: z.array(z.object({
      description: z.string(),
      amount: z.number(),
    })),
  }),
  handler: async ({ employeeId, month }) => ({
    total: 500,
    items: [],
  }),
});

// ============================================
// Finance SubAgent Definition
// ============================================
// The description is what the orchestrator's AI reads to decide when to delegate.
// The instructions are what the subagent's own AI reads when running in worker mode.
// The needsInput pattern in instructions teaches the AI to ask for missing info
// rather than guessing — the orchestrator relays questions back to the user.

export const financeAgent = new SubAgent({
  name: "finance",
  description: `Delegate finance tasks to the Finance specialist.
Use for: expense reports, budget inquiries, reimbursements.`,
  instructions: `You are a Finance specialist.

## Capabilities
- Get expense reports (requires: employeeId, month)

## IMPORTANT: If you don't have required information
Return immediately with needsInput=true and list what you need:
\`\`\`
return { action: 'done', success: false, needsInput: true, result: 'Need more information', questions: ['What is your employee ID?', 'Which month (YYYY-MM)?'] }
\`\`\`

## When you have all required info
Call the appropriate tool, then return the results:
\`\`\`
const result = await getExpenseReport({ employeeId, month })
return { action: 'done', success: true, result: 'Report retrieved', data: result }
\`\`\``,
  tools: [getExpenseReport],
});
