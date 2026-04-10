import { Conversation, user, actions } from "@botpress/runtime";

const WEBCHAT_USER_DATA_TIMEOUT_MS = 2000;

export default new Conversation({
  channel: "webchat.channel",

  async handler({ type, event, execute }) {
    if (type !== "message") return;

    if (!user.state.jwt) {
      try {
        const userId = (event as any)?.userId as string | undefined;
        const ud = await Promise.race([
          actions.webchat.getUserData({ userId: userId as string }),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("timeout")),
              WEBCHAT_USER_DATA_TIMEOUT_MS
            )
          ),
        ]);

        const d = (ud as any)?.userData ?? {};
        if (d.jwt) user.state.jwt = d.jwt;
        if (d.email) user.state.email = d.email;
        if (d.plan) user.state.plan = d.plan;
      } catch {
        // getUserData unavailable (non-webchat channel or timeout)
      }
    }

    const authenticated = !!user.state.jwt;

    await execute({
      instructions: [
        "You are a helpful assistant.",
        "",
        "## Session Context",
        `- Authenticated: ${authenticated ? "YES" : "NO"}`,
        authenticated ? `- Email: ${user.state.email ?? "unknown"}` : "",
        authenticated ? `- Plan: ${user.state.plan ?? "unknown"}` : "",
        "",
        !authenticated
          ? "The user is not logged in. You can still answer general questions."
          : "The user is logged in. You can access their account data.",
      ].join("\n"),
    });
  },
});
