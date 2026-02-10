/**
 * @conversation Guardrails - Webchat Conversation
 *
 * WHY IT'S BUILT THIS WAY:
 * This conversation handler demonstrates the "async guardrail" pattern for topic enforcement.
 *
 * THE ASYNC GUARDRAIL PATTERN IN DETAIL:
 *
 * 1. FIRE EARLY (before execute):
 *    `adk.zai.check()` is called immediately when the handler starts, BEFORE `execute()`.
 *    This returns a Promise that starts the topic check in the background. The check runs
 *    concurrently with the LLM's initial processing, so it adds zero latency to the happy
 *    path (when the topic is valid).
 *
 * 2. CHECK LATE (in onBeforeExecution hook):
 *    The `onBeforeExecution` hook fires just before the LLM generates its response. Inside
 *    the hook, we `await guardAsync` to get the check result. If the topic is off-limits,
 *    we throw an error that interrupts the LLM's response generation.
 *
 * WHY zai.check (not a custom LLM call):
 *    zai.check is purpose-built for boolean validation checks. It takes the transcript,
 *    a natural language condition, and few-shot examples, and returns true/false. It's
 *    optimized for speed and consistency — more reliable than asking a general LLM "is this
 *    on topic?" and parsing the response.
 *
 * WHY THE `triggered` FLAG:
 *    The onBeforeExecution hook can fire multiple times during a single execute() call (once
 *    per LLM iteration). The `triggered` flag ensures the custom "TopicError" message is
 *    only sent once, preventing duplicate guardrail notifications in the chat.
 *
 * WHY THROW AN ERROR (not return false):
 *    Throwing inside onBeforeExecution interrupts the LLM's autonomous loop. The error message
 *    is visible to the LLM, so it includes recovery instructions: "You should recover
 *    seamlessly from this by bringing the user back on topic." The LLM then gracefully
 *    redirects the conversation rather than just going silent.
 *
 * WHY FEW-SHOT EXAMPLES IN zai.check:
 *    The examples teach zai.check the boundary cases: "AI agents" should pass (it's a core
 *    Botpress concept), while "cooking recipes" should fail. Without examples, edge cases
 *    like "Tell me about AI" might be incorrectly flagged as off-topic.
 *
 * WHY CUSTOM MESSAGE TYPE (TopicError):
 *    The custom message with url "custom://guardrail" renders a visual error component in the
 *    webchat UI (a red banner or card), giving the user clear visual feedback that their
 *    message was blocked — not just a text response that could be confused with normal chat.
 */
import { adk, context, Conversation, z } from "@botpress/runtime";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z.object({}),

  handler: async ({ execute, conversation }) => {
    // Fetch the full conversation transcript — zai.check needs the complete context to
    // evaluate whether the TOPIC (not just the last message) is about Botpress.
    // A single off-topic message in an otherwise on-topic conversation may be tolerated;
    // a sustained drift away from Botpress should trigger the guardrail.
    const transcript = await context.get("chat").fetchTranscript();

    // FIRE EARLY: Start the topic check immediately, BEFORE execute().
    // This runs concurrently with the LLM's processing, adding zero latency to the happy path.
    let triggered = false;
    const guardAsync = adk.zai.check(
      transcript,
      `Is the transcript topic specifically about "Botpress" and nothing else? (pay attention to the last user messages).\nGreetings are tolarated as long as the main topic is about Botpress.\nIf the topic starts to drift away from Botpress, the answer should be NO.`,
      {
        examples: [
          {
            input: "User: Tell me about Botpress features.",
            check: true,
            reason: "The topic is about Botpress",
          },
          {
            input: "User: Tell me about AI agents.",
            check: true,
            reason: "AI agents are a core feature of Botpress",
          },
          {
            input: "User: Tell me about cooking recipes.",
            check: false,
            reason: "Cooking recipes are not related to Botpress",
          },
        ],
      }
    );

    await execute({
      instructions:
        "You are a helpful assistant that only talks about Botpress. If the user asks about anything else, try to bring them back on topic.",
      hooks: {
        // CHECK LATE: The hook fires just before the LLM generates its response.
        // Awaiting the guard here means the check result is ready (it started earlier),
        // and we can block the response if the topic is off-limits.
        onBeforeExecution: async () => {
          const guard = await guardAsync;

          if (!guard && !triggered) {
            triggered = true;
            // Send a visual guardrail notification to the frontend
            await conversation.send({
              type: "custom",
              payload: {
                url: "custom://guardrail",
                name: "TopicError",
                data: {
                  name: "Out of Topic",
                  message: `Topic is not about Botpress`,
                },
              },
            });

            // Throwing interrupts the LLM's response generation. The error message is
            // visible to the LLM and includes recovery instructions so it redirects
            // the conversation gracefully rather than going silent.
            throw new Error(
              `Conversation stopped by guardrail. The topic of the conversation can only be about Botpress. You should recover seamlessly from this by bringing the user back on topic.`
            );
          }
        },
      },
    });
  },
});
