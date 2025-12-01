import { Conversation } from "@botpress/runtime";
import { hrAgent, itAgent, salesAgent, financeAgent, docsAgent } from "../agents";
import type { StepData } from "../subagent";

// Kill switch for debug step messages
const DEBUG_STEPS = true;

/**
 * Main Orchestrator
 *
 * This conversation handler acts as the orchestrator in the multi-agent system.
 * It follows the Claude Code pattern:
 *
 * 1. Only the orchestrator talks to the user
 * 2. Subagents run in isolated contexts (separate execute() loops)
 * 3. Subagents return results, not full conversation
 * 4. Orchestrator synthesizes results into user-friendly responses
 */
export default new Conversation({
  channel: ["chat.channel", "webchat.channel"],

  handler: async ({ execute, conversation, channel }) => {
    // Step function for UI updates
    const step = (msg: string, data: StepData) => {
      if (!DEBUG_STEPS) return;

      if (channel === "chat.channel") {
        conversation.send({ type: "text", payload: { text: `[>] ${msg}` } });
        return;
      }

      if (channel === "webchat.channel") {
        conversation.send({
          type: "custom",
          payload: { url: "subagent", name: msg, data: { ...data, ts: Date.now() } },
        });
        return;
      }
    };

    await execute({
      instructions: `You are an orchestrator that routes user requests to specialist agents.

## WHEN TO DELEGATE
Delegate to a specialist ONLY when the user has a specific task or question in their domain:
- **hr_agent**: vacation booking, leave balance, benefits, HR policies
- **it_agent**: password resets, system status, support tickets, IT policies
- **sales_agent**: promotions, products, quotes, orders
- **finance_agent**: expense reports, budgets, reimbursements
- **docs_agent**: Question about the botpress platform

## WHEN NOT TO DELEGATE
Handle these yourself - do NOT delegate:
- Greetings ("hey", "hi", "hello") - respond with a friendly greeting AND briefly mention what you can help with
- General questions ("what can you help with?")
- Clarifying what the user needs
- Chitchat or off-topic conversation

## RULES
1. For domain tasks → delegate immediately, let specialist determine what info they need
2. If specialist returns needsInput=true → ask user the specialist's questions
3. Present specialist results naturally
4. Stay invisible - don't mention "agents" or "delegating"

## Flow
1. User makes request → Immediately delegate to appropriate specialist
2. Specialist returns result → Present it naturally to user
3. Specialist returns needsInput=true → Ask user the specialist's questions, then call specialist again with context

## Example
User: "I want to book vacation"
You: [Call hr_agent with task="book vacation for user"]
HR returns: { needsInput: true, questions: ["What is your employee ID?", "What dates?"] }
You: "I'd be happy to help! Could you provide your employee ID and the dates you'd like off?"
User: "EMP123, Dec 20-25"
You: [Call hr_agent with task="book vacation" and context={ employeeId: "EMP123", dates: "Dec 20-25" }]
HR returns: { success: true, result: "Vacation booked", data: { confirmationId: "VAC-123" } }
You: "Your vacation has been booked! Confirmation: VAC-123"
`,
      tools: [
        hrAgent.asTool(execute, step),
        itAgent.asTool(execute, step),
        salesAgent.asTool(execute, step),
        financeAgent.asTool(execute, step),
        docsAgent.asTool(execute, step),
      ],
    });
  },
});
