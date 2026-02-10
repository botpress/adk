import { adk, context, Conversation, z } from "@botpress/runtime";

/** Topic guardrail conversation handler. */
export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z.object({}),

  handler: async ({ execute, conversation }) => {
    // context.get("chat") accesses the chat context for the current conversation.
    // fetchTranscript() returns the full conversation history as TranscriptItem[] —
    // zai.check() stringifies it internally. We pass the full transcript so it can
    // evaluate the overall topic, not just the latest message.
    const transcript = await context.get("chat").fetchTranscript();

    // Prevents sending the guardrail UI message more than once per handler
    // invocation. onBeforeExecution fires each iteration of the agent loop,
    // but the user should only see one guardrail warning per message.
    let triggered = false;

    // adk.zai.check() asks the LLM a yes/no question about the input.
    // Started here (before execute) so it runs concurrently with the agent loop.
    // The examples improve classification accuracy by showing the LLM
    // what counts as on-topic vs off-topic.
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
        // onBeforeExecution fires before each iteration of the agent loop.
        // Why this instead of onBeforeTool (like webchat-rag's guardrails)?
        // onBeforeTool only fires when the AI calls a tool — if the AI responds
        // directly without tools, it never triggers. onBeforeExecution catches everything.
        onBeforeExecution: async () => {
          const guard = await guardAsync;

          if (!guard && !triggered) {
            triggered = true;

            // Send a custom message the frontend renders as a guardrail warning.
            // url "custom://guardrail" — CustomTextRenderer matches on this.
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

            // Throwing an error from a hook passes the error message to the AI
            // as context for the next iteration. The AI reads "recover seamlessly"
            // and redirects the user back to Botpress topics — it doesn't crash.
            throw new Error(
              `Conversation stopped by guardrail. The topic of the conversation can only be about Botpress. You should recover seamlessly from this by bringing the user back on topic.`
            );
          }
        },
      },
    });
  },
});
