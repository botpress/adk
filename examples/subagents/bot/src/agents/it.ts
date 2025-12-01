import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

// ============================================
// IT Tools
// ============================================

const resetPassword = new Tool({
  name: "resetPassword",
  description: "Reset a user's password and generate a temporary one",
  input: z.object({
    userId: z.string().describe("The user ID"),
  }),
  output: z.object({
    success: z.boolean(),
    temporaryPassword: z.string(),
    message: z.string(),
  }),
  handler: async ({ userId }) => ({
    success: true,
    temporaryPassword: `Temp${Math.random().toString(36).slice(2, 10)}!`,
    message: `Password reset for ${userId}. User must change password on next login.`,
  }),
});

const checkSystemStatus = new Tool({
  name: "checkSystemStatus",
  description: "Check status of company systems and services",
  input: z.object({
    system: z.string().optional().describe("Specific system to check, or omit for all"),
  }),
  output: z.object({
    systems: z.array(
      z.object({
        name: z.string(),
        status: z.enum(["operational", "degraded", "outage"]),
        message: z.string().optional(),
      })
    ),
  }),
  handler: async ({ system }) => ({
    systems: [
      { name: "Email", status: "operational" as const },
      { name: "VPN", status: "operational" as const },
      { name: "File Storage", status: "operational" as const },
      { name: "HR Portal", status: "degraded" as const, message: "Slow performance, investigating" },
    ],
  }),
});

const createTicket = new Tool({
  name: "createTicket",
  description: "Create an IT support ticket",
  input: z.object({
    title: z.string().describe("Brief description of the issue"),
    description: z.string().describe("Detailed description"),
    priority: z.enum(["low", "medium", "high", "critical"]).describe("Priority level"),
    userId: z.string().describe("User reporting the issue"),
  }),
  output: z.object({
    ticketId: z.string(),
    estimatedResponse: z.string(),
  }),
  handler: async ({ title, priority, userId }) => {
    const responseTime = { low: "48h", medium: "24h", high: "4h", critical: "1h" };
    return {
      ticketId: `IT-${Date.now()}`,
      estimatedResponse: responseTime[priority],
    };
  },
});

const getITPolicies = new Tool({
  name: "getITPolicies",
  description: "Get IT security policies and guidelines",
  input: z.object({
    topic: z.string().optional().describe("Specific policy topic"),
  }),
  output: z.object({
    policies: z.array(z.object({ name: z.string(), description: z.string() })),
  }),
  handler: async ({ topic }) => ({
    policies: [
      { name: "Password Policy", description: "Min 12 chars, uppercase, lowercase, number, special char. Change every 90 days." },
      { name: "VPN Policy", description: "Required for remote access. Auto-disconnect after 8 hours." },
      { name: "Software Policy", description: "Only IT-approved software. Submit requests via IT portal." },
      { name: "Data Security", description: "Encrypt sensitive data. No storage on personal devices." },
    ],
  }),
});

// ============================================
// IT SubAgent Definition
// ============================================

export const itAgent = new SubAgent({
  name: "it",
  description: `Delegate IT-related tasks to the IT specialist.
Use for: password resets, system status checks, IT support tickets, IT policy questions.`,
  instructions: `You are an IT support specialist.

## Capabilities
- Reset passwords (requires: userId)
- Check system status (no requirements)
- Create support tickets (requires: userId, title, description, priority)
- Provide IT policy information (no requirements)

## IMPORTANT: If you don't have required information
Return immediately with needsInput=true and list what you need:
\`\`\`
return { action: 'done', success: false, needsInput: true, result: 'Need more information', questions: ['What is your user ID?', 'Describe your issue'] }
\`\`\`

## When you have all required info
Call the appropriate tool, then return the results:
\`\`\`
const result = await createTicket({ userId, title, description, priority })
return { action: 'done', success: true, result: 'Ticket created', data: result }
\`\`\``,
  tools: [resetPassword, checkSystemStatus, createTicket, getITPolicies],
});
