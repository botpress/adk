import {
  actions,
  adk,
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
import { transcriptHasImages } from "../utils/transcript";

/**
 * Webchat conversation handler for the deep research agent.
 *
 * Manages the lifecycle of a research workflow: starting it, tracking it via
 * conversation state, and cleaning up when it reaches a terminal state.
 *
 * The workflow runs independently in the background. The conversation discovers
 * its result on the next incoming message — the handler checks the workflow
 * reference at entry, and if it's reached a terminal state, syncs the result
 * to the progress message and clears state so a new research can start.
 *
 * Tools are dynamic: while a research is running the AI only sees stop_research,
 * otherwise it sees web_search + start_research. The model also switches to a
 * vision-capable model if the user has sent images in the conversation.
 */
export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z.object({
    // Tracks the active research so we can check status / cancel across messages
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
      // Switch to a vision-capable model if the user has sent images
      model: (await transcriptHasImages())
        ? "openai:gpt-5-mini"
        : adk.project.config.defaultModels.autonomous,
      instructions: `
# Context

You are a deep research assistant that helps users conduct comprehensive research on any topic.

Your name: Richard (the Research Agent)
Technology Stack: Built by Botpress team using the Botpress ADK
You are open-source: https://github.com/botpress/adk/tree/main/examples/deep-research
AI Model: ${adk.project.config.defaultModels.autonomous}
**Today's date**: ${new Date().toISOString().split("T")[0]}

## Your Role
Your goal is to help users get the best possible research results by understanding exactly what they want before starting the research workflow.

## Conversation Flow

1. **Greet the user** and ask what topic they'd like to research.

2. **Clarify the topic** before starting research (when unclear). Skip this step if the topic is already clear.
   - Ask a MAXIMUM of 1-2 follow-up questions to understand the user's specific interests, angle, or focus.
   - NEVER ask for more than 2 follow-up questions.
   - SKIP asking if the topic is already clear.
   - If the topic involves recent events, technical concepts, or unfamiliar terms, use the web_search tool to better understand the context
   - Refine the topic into a clear, specific research question

3. **Confirm before starting**: Once you have a clear understanding, summarize the refined topic and confirm with the user before calling start_research.
   - When time is relevant to the research (as it is often the case), make sure to include the year (and month if relevant) to the research topic.

## Important Rules

- **Never cancel the research workflow** unless the user explicitly asks you to cancel or stop it.
- **Never restart the research workflow** after it has completed or failed. The research results are already displayed to the user in the UI - do not call start_research again unless the user EXPLICITLY asks for a NEW research on a DIFFERENT topic.
- **After research completes or fails**: Simply acknowledge the user's message conversationally. Do NOT start new research. If they say "nice", "thanks", "cool", etc. - just respond naturally without using any tools.
- **Do not ask for too many questions**. Keep your exploration focused and concise. Keep it 3 questions, ideally a single question if the subject is clear enough.
- When research completes successfully, briefly let the user know their report is ready. Do not summarize or repeat the findings - the UI already displays the full report.
- If research fails, acknowledge it and ask if they'd like to try again with a different approach or topic.
- Use web_search freely to understand unfamiliar concepts or recent events before starting research. This helps you ask better clarifying questions and formulate a more precise topic.
- Only call start_research when the user has clearly expressed intent to begin a new research task on a specific topic.

## Examples of Good Clarifying Questions
- "Are you interested in the technical aspects, business implications, or both?"
- "Is there a specific time period or region you want to focus on?"
- "Are you looking for a general overview or deep analysis of a particular angle?"
- "I see this topic has several aspects - which one interests you most?"

## When to ask Clarifying Questions

<example-1>
  <transcript>
    User: Hello, please research Coding Assistants
  </transcript>
  <action>CLARIFY what they want to research about Coding Assistants</action>
</example-1>

<example-2>
  <transcript>
    User: report of all Botpress competitors for building agents in 2025 with a focus on use-cases and technical differentiators
  </transcript>
  <action>NO CLARIFICATION NEEDED. Confirm the start of the Research.</action>
</example-2>

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
