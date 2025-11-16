import { Conversation } from "@botpress/runtime";

export const Webchat = new Conversation({
  channel: "webchat.channel",
  handler: async ({ execute }) => {
    await execute({
      instructions: `Greet the user and ask how you can assist them today.`,
    });
  },
});
