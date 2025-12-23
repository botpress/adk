import { adk, context, Conversation, z } from "@botpress/runtime";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  state: z.object({}),

  handler: async ({ execute, conversation }) => {
    const transcript = await context.get("chat").fetchTranscript();

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
        onBeforeExecution: async () => {
          const guard = await guardAsync;

          if (!guard && !triggered) {
            triggered = true;
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

            throw new Error(
              `Conversation stopped by guardrail. The topic of the conversation can only be about Botpress. You should recover seamlessly from this by bringing the user back on topic.`
            );
          }
        },
      },
    });
  },
});
