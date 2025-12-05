import {
  actions,
  Autonomous,
  Conversation,
  Reference,
  z,
} from "@botpress/runtime";
import { DeepResearchWorkflow } from "../workflows";

import {
  createResearchProgressComponent,
  updateResearchProgressComponent,
} from "../utils/progress-component";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z.object({
    messageId: z.string().optional(),
    research: Reference.Workflow("deep_research").optional(),
  }),
  handler: async ({ execute, conversation, state }) => {
    // Check workflow status on every handler call if we have an active research
    if (state.research && state.messageId) {
      const workflowStatus = state.research.workflow.status;
      const workflowInput = state.research.workflow.input;
      const workflowOutput = state.research.workflow.output;

      // Check if workflow has reached a terminal state
      const isCompleted = workflowStatus === "completed";
      const isFailed = workflowStatus === "failed";
      const isTimedOut = workflowStatus === "timedout";
      const isTerminal = isCompleted || isFailed || isTimedOut;

      if (isTerminal) {
        // Determine if it was successful
        const isSuccess = isCompleted && workflowOutput?.report;

        let errorMessage: string | undefined;
        if (isFailed) {
          errorMessage = "The research workflow encountered an error.";
        } else if (isTimedOut) {
          errorMessage = "The research workflow timed out.";
        } else if (!workflowOutput?.report) {
          errorMessage = "The research completed but no report was generated.";
        }

        await updateResearchProgressComponent(state.messageId, {
          progress: isSuccess ? 100 : undefined,
          startedAt: new Date().toISOString(),
          status: isSuccess ? "done" : "errored",
          result: isSuccess ? workflowOutput?.report : undefined,
          summary: isSuccess ? workflowOutput?.summary : undefined,
          error: errorMessage,
          title:
            workflowOutput?.title ||
            (isSuccess ? "Research Complete" : "Research Failed"),
          topic: workflowInput.topic,
          sources: workflowOutput?.sources || [],
        });
        state.messageId = undefined;
        state.research = undefined;
      }
    }

    // Web search tool for clarifying questions and understanding context (no browsing)
    const webSearchTool = new Autonomous.Tool({
      name: "web_search",
      description:
        "Search the web to understand unfamiliar concepts, recent events, or gather context before starting research. Use this to ask better clarifying questions.",
      input: z.object({
        query: z.string().describe("The search query"),
      }),
      output: z.object({
        results: z.array(
          z.object({
            url: z.string(),
            name: z.string(),
            snippet: z.string(),
          })
        ),
      }),
      handler: async ({ query }) => {
        const response = await actions.browser.webSearch({
          query,
          count: 5,
          browsePages: false,
        });
        return {
          results: response.results.map((r) => ({
            url: r.url,
            name: r.name,
            snippet: r.snippet,
          })),
        };
      },
    });

    const startResearchTool = new Autonomous.Tool({
      name: "start_research",
      input: z.object({
        topic: z
          .string()
          .min(1)
          .describe(
            "A clear, well-defined research topic that has been refined through conversation with the user. Should be specific enough to guide comprehensive research."
          ),
      }),
      output: z.string(),
      handler: async (args) => {
        if (state.research) {
          return "A research task is already in progress. Please wait for it to complete before starting a new one.";
        }

        const message = await createResearchProgressComponent({
          progress: 0,
          startedAt: new Date().toISOString(),
          activities: [],
          status: "in_progress",
          title: args.topic,
          topic: args.topic,
          sources: [],
        });

        const workflow = await DeepResearchWorkflow.start({
          conversationId: conversation.id,
          messageId: message.id,
          topic: args.topic,
        });

        state.research = workflow;
        state.messageId = message.id;

        return "Research started successfully.";
      },
    });

    const stopResearchTool = new Autonomous.Tool({
      name: "stop_research",
      input: z.object({}).optional(),
      output: z.string(),
      handler: async () => {
        console.log("Cancelling research workflow:", state.research?.id);
        if (state.research) {
          await state.research.cancel();
          state.research = undefined;
        }
        console.log(
          "Updating progress component to reflect cancellation.",
          state.messageId
        );
        if (state.messageId) {
          await updateResearchProgressComponent(state.messageId, {
            progress: 0,
            startedAt: new Date().toISOString(),
            status: "cancelled",
            title: "Research Cancelled",
            topic: "N/A",
            sources: [],
          });
          state.messageId = undefined;
        }

        return "The research has been cancelled.";
      },
    });

    await execute({
      instructions: `You are a deep research assistant that helps users conduct comprehensive research on any topic.

## Your Role
Your goal is to help users get the best possible research results by understanding exactly what they want before starting the research workflow.

## Conversation Flow

1. **Greet the user** and ask what topic they'd like to research.

2. **Clarify the topic** before starting research:
   - Ask 1-2 follow-up questions to understand the user's specific interests, angle, or focus
   - If the topic involves recent events, technical concepts, or unfamiliar terms, use the web_search tool to better understand the context
   - Refine the topic into a clear, specific research question

3. **Confirm before starting**: Once you have a clear understanding, summarize the refined topic and confirm with the user before calling start_research.

## Important Rules

- **Never cancel the research workflow** unless the user explicitly asks you to cancel or stop it.
- **Never restart the research workflow** after it has completed or failed. The research results are already displayed to the user in the UI - do not call start_research again unless the user EXPLICITLY asks for a NEW research on a DIFFERENT topic.
- **After research completes or fails**: Simply acknowledge the user's message conversationally. Do NOT start new research. If they say "nice", "thanks", "cool", etc. - just respond naturally without using any tools.
- When research completes successfully, briefly let the user know their report is ready. Do not summarize or repeat the findings - the UI already displays the full report.
- If research fails, acknowledge it and ask if they'd like to try again with a different approach or topic.
- Use web_search freely to understand unfamiliar concepts or recent events before starting research. This helps you ask better clarifying questions and formulate a more precise topic.
- Only call start_research when the user has clearly expressed intent to begin a new research task on a specific topic.

## Examples of Good Clarifying Questions
- "Are you interested in the technical aspects, business implications, or both?"
- "Is there a specific time period or region you want to focus on?"
- "Are you looking for a general overview or deep analysis of a particular angle?"
- "I see this topic has several aspects - which one interests you most?"

## Formatting Guidelines
- **Use buttons** when asking questions with discrete options (e.g., "Technical" vs "Business" or "Overview" vs "Deep dive"). This makes it easier and more convenient for the user to respond.
- **Use rich markdown formatting**: headers, bold, italics, bullet points, and tables where appropriate to make information clear and scannable.
- Keep messages concise but well-structured.`,
      tools: () =>
        state.research
          ? [stopResearchTool]
          : [webSearchTool, startResearchTool],
    });
  },
});
