import {
  adk,
  Autonomous,
  Conversation,
  Reference,
  z,
} from "@botpress/runtime";
import { BrandExtractionWorkflow } from "../workflows";
import {
  createBrandProgressComponent,
  updateBrandProgressComponent,
  createInitialSteps,
} from "../utils/progress-component";

/**
 * Webchat conversation handler for the brand extractor.
 * Manages the lifecycle of a brand extraction: starting the workflow,
 * tracking it via conversation state, and cleaning up when it completes.
 *
 * Tools are dynamic — while an extraction is running the AI only sees
 * stop_extraction, otherwise it only sees start_extraction.
 */
export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z.object({
    // Tracks the active extraction so we can update/cancel it across messages
    messageId: z.string().optional(),
    extraction: Reference.Workflow("brand_extraction").optional(),
  }),
  handler: async ({ execute, conversation, state }) => {
    // Check workflow status on every handler call if we have an active extraction
    if (state.extraction && state.messageId) {
      const workflowStatus = state.extraction.workflow.status;
      const workflowInput = state.extraction.workflow.input;
      const workflowOutput = state.extraction.workflow.output;

      // Check if workflow has reached a terminal state
      const isCompleted = workflowStatus === "completed";
      const isFailed = workflowStatus === "failed";
      const isTimedOut = workflowStatus === "timedout";
      const isTerminal = isCompleted || isFailed || isTimedOut;

      if (isTerminal) {
        const isSuccess = isCompleted && workflowOutput?.brandData;

        let errorMessage: string | undefined;
        if (isFailed) {
          errorMessage = "The brand extraction encountered an error.";
        } else if (isTimedOut) {
          errorMessage = "The brand extraction timed out.";
        } else if (!workflowOutput?.brandData) {
          errorMessage =
            "The extraction completed but no brand data was generated.";
        }

        await updateBrandProgressComponent(state.messageId, {
          status: isSuccess ? "done" : "errored",
          companyName: workflowInput.input,
          error: errorMessage,
          brandData: workflowOutput?.brandData,
          steps: createInitialSteps(),
        });

        state.messageId = undefined;
        state.extraction = undefined;
      }
    }

    // Tool to start brand extraction
    const startExtractionTool = new Autonomous.Tool({
      name: "start_extraction",
      description:
        "Start extracting brand colors and logo from a company's website. Can accept either a website URL or a company name.",
      input: z.object({
        input: z
          .string()
          .min(1)
          .describe(
            "Either a website URL (e.g., 'apple.com' or 'https://apple.com') or a company name (e.g., 'Apple')"
          ),
      }),
      output: z.string(),
      handler: async (args) => {
        if (state.extraction) {
          return "A brand extraction is already in progress. Please wait for it to complete or cancel it first.";
        }

        const message = await createBrandProgressComponent({
          status: "in_progress",
          companyName: args.input,
          steps: createInitialSteps(),
        });

        const workflow = await BrandExtractionWorkflow.start({
          conversationId: conversation.id,
          messageId: message.id,
          input: args.input,
        });

        state.extraction = workflow;
        state.messageId = message.id;

        return "Brand extraction started successfully.";
      },
    });

    // Tool to cancel extraction
    const stopExtractionTool = new Autonomous.Tool({
      name: "stop_extraction",
      description: "Cancel the current brand extraction process.",
      input: z.object({}).optional(),
      output: z.string(),
      handler: async () => {
        console.log("Cancelling brand extraction:", state.extraction?.id);

        if (state.extraction) {
          await state.extraction.cancel();
          state.extraction = undefined;
        }

        if (state.messageId) {
          await updateBrandProgressComponent(state.messageId, {
            status: "cancelled",
            companyName: "N/A",
            steps: createInitialSteps(),
          });
          state.messageId = undefined;
        }

        return "The brand extraction has been cancelled.";
      },
    });

    await execute({
      model: adk.project.config.defaultModels.autonomous,
      instructions: `
# Context

You are a Brand Extractor assistant that helps users extract branding information (colors, logo) from company websites.

Your name: Brandy (the Brand Extractor)
Technology Stack: Built by Botpress team using the Botpress ADK
**Today's date**: ${new Date().toISOString().split("T")[0]}

## Your Role

Your goal is to help users extract brand colors and logos from any company's website. You can work with:
- A direct website URL (e.g., "apple.com", "https://google.com")
- A company name (e.g., "Spotify", "Nike") - you'll find their website automatically

## Conversation Flow

1. **Greet the user** and ask what company's branding they'd like to extract.

2. **Clarify if needed** (usually not necessary):
   - If the user gives a very ambiguous company name, you can ask for clarification
   - But in most cases, just proceed with the extraction

3. **Start the extraction**: Once you know the target, call start_extraction with either the URL or company name.

## Important Rules

- **Never cancel the extraction** unless the user explicitly asks you to cancel or stop it.
- **Never restart the extraction** after it completes. The results are displayed in the UI.
- **After extraction completes or fails**: Simply acknowledge the user's message conversationally. If they say "nice", "thanks", "cool", etc. - just respond naturally without using any tools.
- When extraction completes successfully, acknowledge it briefly. **Do NOT repeat the colors, hex values, or theme details** - the UI component already displays all of this visually in an interactive card.
- If extraction fails, acknowledge it and ask if they'd like to try again with a different URL or company.

## Example Interactions

**User**: "Extract branding from stripe.com"
**Action**: Call start_extraction with input "stripe.com"
**Response after completion**: "Done! I've extracted Stripe's brand colors and logo. You can see the light and dark themes above, and copy them in CSS, JSON, or Tailwind format."

**User**: "Get me the brand colors for Notion"
**Action**: Call start_extraction with input "Notion"

**User**: "I need the logo and colors for https://figma.com"
**Action**: Call start_extraction with input "https://figma.com"

## Formatting Guidelines
- Keep messages concise and friendly
- **Don't list out colors or hex values** - the visual component shows everything
- Just confirm the extraction is complete and point users to the card above
- Use short, natural responses`,
      tools: () =>
        state.extraction ? [stopExtractionTool] : [startExtractionTool],
    });
  },
});
