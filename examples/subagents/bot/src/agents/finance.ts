// src/agents/finance.ts
import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

// Define tools
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
  handler: async ({ employeeId, month }) => {
    // Your implementation
    return { total: 500, items: [] };
  },
});

// Create the agent
export const financeAgent = new SubAgent({
  name: "finance",
  description: `Delegate finance tasks to the Finance specialist.
Use for: expense reports, budget inquiries, reimbursements.`,
  instructions: `You are a Finance specialist.

## Capabilities
- Get expense reports (requires: employeeId, month)
- Check budgets (requires: departmentId)

## If missing required info
Return with needsInput=true:
\`\`\`
return { action: 'done', success: false, needsInput: true,
         result: 'Need more info', questions: ['What is your employee ID?'] }
\`\`\`

## When you have all info
\`\`\`
const result = await getExpenseReport({ employeeId, month })
return { action: 'done', success: true, result: 'Report retrieved', data: result }
\`\`\``,
  tools: [getExpenseReport],
});