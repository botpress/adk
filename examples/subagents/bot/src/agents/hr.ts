/**
 * @subagent HR Agent
 * @pattern Specialist Worker with Domain-Specific Tools
 *
 * WHY THIS FILE IS STRUCTURED THIS WAY:
 * Each subagent file follows a consistent pattern: define domain tools, then create a
 * SubAgent that combines those tools with specialist instructions. This separation means
 * tools are reusable (could be shared with other agents) and the SubAgent config is declarative.
 *
 * WHY MOCK TOOL HANDLERS (not real API calls):
 * These are example/demo implementations. In production, the handlers would call real HR
 * systems (Workday, BambooHR, etc.) via API. The tool schemas (input/output types) are the
 * important part — they define the contract between the LLM and the backend system.
 *
 * WHY THE INSTRUCTIONS INCLUDE EXPLICIT RETURN FORMAT:
 * Worker-mode LLMs need very explicit instructions about how to complete their task. The
 * instructions include code-block examples of the SubAgentExit format because the LLM
 * needs to understand that it returns structured data via the "done" exit, not by sending
 * messages. Without these examples, the LLM often tries to conversationally respond instead
 * of triggering the exit.
 *
 * WHY needsInput PATTERN:
 * The instructions teach the subagent to return immediately with needsInput=true when it
 * doesn't have required information (e.g., employee ID). This is more efficient than having
 * the subagent try to call a tool with missing parameters, fail, and then figure out what
 * to do. The early-return pattern saves LLM iterations and provides clear questions for the
 * orchestrator to relay to the user.
 */
import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

// ============================================
// HR Tools — Mock implementations for demo purposes.
// In production, these handlers would call real HR system APIs.
// The Zod schemas define the contract between the LLM and the backend.
// ============================================

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
