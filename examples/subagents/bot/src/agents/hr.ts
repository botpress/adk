import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

// ============================================
// HR Tools
// ============================================
// All tool handlers return hardcoded mock data — in a real agent these would
// call an HR system API. The schemas are what matter: they define the contract
// the AI uses to decide which tool to call and how to present the result.

const bookVacation = new Tool({
  name: "bookVacation",
  description: "Book vacation time for an employee",
  input: z.object({
    employeeId: z.string().describe("The employee ID"),
    startDate: z.string().describe("Start date (YYYY-MM-DD)"),
    endDate: z.string().describe("End date (YYYY-MM-DD)"),
  }),
  output: z.object({
    success: z.boolean(),
    confirmationNumber: z.string(),
    message: z.string(),
  }),
  handler: async ({ employeeId, startDate, endDate }) => ({
    success: true,
    confirmationNumber: `VAC-${Date.now()}`,
    message: `Vacation booked for ${employeeId} from ${startDate} to ${endDate}`,
  }),
});

const checkVacationBalance = new Tool({
  name: "checkVacationBalance",
  description: "Check remaining vacation days for an employee",
  input: z.object({
    employeeId: z.string().describe("The employee ID"),
  }),
  output: z.object({
    totalDays: z.number(),
    usedDays: z.number(),
    remainingDays: z.number(),
  }),
  handler: async ({ employeeId }) => ({
    totalDays: 20,
    usedDays: 5,
    remainingDays: 15,
  }),
});

const getBenefits = new Tool({
  name: "getBenefits",
  description: "Get employee benefits information",
  input: z.object({
    employeeId: z.string().describe("The employee ID"),
  }),
  output: z.object({
    benefits: z.array(z.string()),
  }),
  handler: async ({ employeeId }) => ({
    benefits: [
      "Health insurance (medical, dental, vision)",
      "401(k) with 6% company match",
      "20 days PTO annually",
      "12 weeks paid parental leave",
      "Life insurance",
      "Employee assistance program",
    ],
  }),
});

// ============================================
// HR SubAgent Definition
// ============================================
// The description is what the orchestrator's AI reads to decide when to delegate.
// The instructions are what the subagent's own AI reads when running in worker mode.
// The needsInput pattern in instructions teaches the AI to ask for missing info
// rather than guessing — the orchestrator relays questions back to the user.

export const hrAgent = new SubAgent({
  name: "hr",
  description: `Delegate HR-related tasks to the HR specialist.
Use for: vacation booking, vacation balance checks, benefits information, HR policy questions.`,
  instructions: `You are an HR specialist.

## Capabilities
- Book vacation (requires: employeeId, startDate, endDate)
- Check vacation balance (requires: employeeId)
- Get benefits info (requires: employeeId)

## IMPORTANT: If you don't have required information
Return immediately with needsInput=true and list what you need:
\`\`\`
return { action: 'done', success: false, needsInput: true, result: 'Need more information', questions: ['What is your employee ID?', 'What dates would you like off?'] }
\`\`\`

## When you have all required info
Call the appropriate tool, then return the results:
\`\`\`
const result = await bookVacation({ employeeId, startDate, endDate })
return { action: 'done', success: true, result: 'Vacation booked', data: result }
\`\`\``,
  tools: [bookVacation, checkVacationBalance, getBenefits],
});
