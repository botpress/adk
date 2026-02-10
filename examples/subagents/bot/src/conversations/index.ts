/**
 * @conversation Subagents - Orchestrator Conversation
 *
 * WHY IT'S BUILT THIS WAY:
 * This conversation handler is the ORCHESTRATOR in a multi-agent system. It implements the
 * "tools-as-subagents" pattern: each SubAgent is converted to an Autonomous.Tool via
 * `.asTool()`, making subagent invocation look like a regular tool call to the orchestrator LLM.
 *
 * HOW THE MULTI-AGENT FLOW WORKS:
 * 1. User sends "I want to book vacation"
 * 2. Orchestrator LLM sees 5 tools (hr_agent, it_agent, sales_agent, finance_agent, docs_agent)
 * 3. It calls hr_agent tool with { task: "book vacation for user" }
 * 4. SubAgent.asTool() delegates to SubAgent.run(), which starts a NEW execute() in worker mode
 * 5. The HR subagent's LLM runs autonomously: checks if it has enough info -> if not,
 *    returns { needsInput: true, questions: ["What is your employee ID?", "What dates?"] }
 * 6. The orchestrator receives this structured output and asks the user those questions
 * 7. User answers -> orchestrator calls hr_agent again with the context
 * 8. HR subagent calls bookVacation tool -> returns { success: true, data: { confirmationId: ... } }
 * 9. Orchestrator presents the result naturally to the user
 *
 * WHY SUBAGENTS AS TOOLS (not separate conversation handlers):
 * By converting subagents to tools, the orchestrator LLM natively handles routing — it
 * decides which "tool" (subagent) to call based on the user's message, just like it decides
 * to call any other tool. This is more reliable than explicit if/else routing because the
 * LLM understands natural language intent.
 *
 * WHY execute AND step ARE PASSED TO asTool():
 * Subagents need the `execute` function to create their own isolated LLM context (worker mode).
 * The `step` function provides UI feedback (debug messages showing what the subagent is doing).
 * These are injected via asTool() rather than being global because each conversation handler
 * has its own execute instance tied to its conversation context.
 *
 * WHY THE step FUNCTION ADAPTS BY CHANNEL:
 * In webchat, steps are sent as custom messages with structured data for the frontend to
 * render as a visual "thinking" indicator. In CLI chat, steps are plain text prefixed with
 * [>] for readability. This demonstrates channel-adaptive UI patterns.
 *
 * WHY DEBUG_STEPS EXISTS:
 * The step messages (showing subagent thinking, tool calls) are useful during development
 * but may be noisy in production. The DEBUG_STEPS flag is a kill switch to disable them.
 */
import { Conversation } from "@botpress/runtime";
import { hrAgent, itAgent, salesAgent, financeAgent, docsAgent } from "../agents";
import type { StepData } from "../subagent";

// Kill switch for debug step messages — set to false in production to hide
// subagent thinking/tool-call traces from the user
const DEBUG_STEPS = true;

export default new Conversation({
  channel: ["chat.channel", "webchat.channel"],

  handler: async ({ execute, conversation, channel }) => {
    // Step function for UI updates — adapts output format based on channel.
    // This function is passed to each subagent via asTool() for real-time
    // progress feedback during subagent execution.
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
