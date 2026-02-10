/**
 * @extension Admin Mode
 * @pattern Time-Limited Code-Based Authentication with Dynamic Tool Sets
 *
 * WHY THIS EXTENSION EXISTS:
 * Certain operations (like re-indexing knowledge bases) should only be available to
 * authenticated admins. This extension implements a code-based authentication flow where:
 * 1. User requests admin access -> a one-time code is generated and logged to the console
 * 2. User retrieves the code from the Botpress dashboard and enters it in chat
 * 3. If valid, user gets 1-hour admin access with privileged tools
 *
 * WHY CODE-BASED AUTH (not password):
 * The code is generated server-side and logged to the developer console — only someone
 * with access to the Botpress dashboard can see it. This provides two-factor-like security
 * without requiring a password database. The code expires after 5 minutes to prevent replay.
 *
 * WHY Autonomous.Object (not just tools):
 * Autonomous.Object groups tools under a named namespace ("admin") with a dynamic description.
 * The description changes based on auth state — telling the LLM whether admin mode is
 * "ENABLED", "EXPIRED", "CODE GENERATED", or "CODE NOT GENERATED". This gives the LLM
 * context about what admin tools are available and why.
 *
 * WHY DYNAMIC TOOL SELECTION (isUserAdmin() ? [refreshTool] : [loginTool]):
 * Admin users see the refreshKnowledgeBases tool. Non-admin users see either loginWithCode
 * (if a code was generated) or generateLoginCode (if no code exists). The LLM physically
 * cannot call tools that aren't in its tool list, so this enforces access control structurally.
 *
 * WHY ThinkSignal (not throw Error):
 * ThinkSignal is a special signal from the llmz library that interrupts the current tool
 * execution and sends a message back to the LLM's thinking loop. Unlike a regular Error
 * (which the LLM sees as a failure), ThinkSignal is treated as an informational redirect —
 * the LLM adjusts its approach rather than entering error recovery mode. Used here to tell
 * the LLM "the code was generated, check the dashboard" without triggering error handling.
 *
 * WHY user.state (not conversation state):
 * Admin status persists in user.state, which survives across conversations. Once authenticated,
 * the user stays admin for 1 hour regardless of which conversation they're in. If this were
 * in conversation state, the user would lose admin access when opening a new chat.
 */
import { adk, Autonomous, user, z } from "@botpress/runtime";
import { ThinkSignal } from "llmz";

export const AdminModeUserSchema: z.ZodRawShape = {
  admin: z
    .object({
      adminUtil: z
        .string()
        .nullable()
        .describe("The expiration date of the admin status in ISO format."),
      code: z.string().nullable().describe("The admin access code."),
      codeValidUntil: z
        .string()
        .nullable()
        .describe("The expiration date of the admin code in ISO format."),
    })
    .default({
      adminUtil: null,
      code: null,
      codeValidUntil: null,
    }),
};

const indexKnowledgeBasesTool = new Autonomous.Tool({
  name: "refreshKnowledgeBases",
  description: "Tool to refresh and re-index all knowledge bases.",
  output: z.string().describe("Confirmation message after refreshing."),
  handler: async () => {
    await Promise.all(adk.project.knowledge.map((kb) => kb.refresh()));
    return `Started the re-indexing process for the following knowledge bases: ${adk.project.knowledge
      .map((kb) => kb.name)
      .join(", ")}`;
  },
});

const getLoginTool = () => {
  const CODE_VALIDITY_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  const expectedCode = user.state.admin?.code?.toLowerCase().trim();
  const codeGenerated =
    expectedCode &&
    user.state.admin?.codeValidUntil &&
    new Date(user.state.admin?.codeValidUntil) > new Date();

  const logCode = (code: string) => {
    console.log(`Generated admin login code: ${code}`);
    console.log(`Code valid until: ${user.state.admin!.codeValidUntil}`);
  };

  if (codeGenerated) {
    return new Autonomous.Tool({
      name: "loginWithCode",
      description: "Tool to log in as admin using an access code.",
      input: z
        .string()
        .describe(
          'The admin access code, which is valid for a limited time. Eg. "ABC346"'
        ),
      output: z.boolean().describe("Returns true if login is successful."),
      handler: async (code: string) => {
        const providedCode = code.toLowerCase().trim();
        if (expectedCode && providedCode === expectedCode) {
          user.state.admin = {
            adminUtil: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour admin access
            code: null,
            codeValidUntil: null,
          };
          return true;
        }

        throw new ThinkSignal("Invalid or expired admin access code");
      },
    });
  }

  return new Autonomous.Tool({
    name: "generateLoginCode",
    description: "Tool to generate a one-time access code for admin login.",
    handler: async () => {
      const generatedCode = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();

      user.state.admin = {
        adminUtil: null,
        code: generatedCode,
        codeValidUntil: new Date(
          Date.now() + CODE_VALIDITY_DURATION_MS
        ).toISOString(),
      };

      logCode(generatedCode);

      throw new ThinkSignal(
        `An admin login code has been generated and has been logged in the developer console of the Botpress dashboard. Please login to the Botpress dashboard to retrieve the code.`
      );
    },
  });
};

function isUserAdmin() {
  return (
    user.state.admin?.adminUtil &&
    user.state.admin?.adminUtil !== null &&
    new Date(user.state.admin.adminUtil) > new Date()
  );
}

function getAdminStatus() {
  const isAdmin = isUserAdmin();
  const hasExpired =
    user.state.admin?.adminUtil &&
    new Date(user.state.admin.adminUtil) <= new Date();
  const isCodeGenerated =
    user.state.admin?.code &&
    user.state.admin?.codeValidUntil &&
    new Date(user.state.admin.codeValidUntil) > new Date();

  const description = `Admin mode functionalities for privileged users, this includes managing and controlling the agent.`;

  if (isAdmin) {
    return [
      description,
      "Current Status: ENABLED",
      `Admin access valid until: ${new Date(
        user.state.admin!.adminUtil!
      ).toLocaleString()}`,
    ].join("\n");
  }

  if (hasExpired) {
    return [
      description,
      "Current Status: EXPIRED",
      "Please generate a new admin access code to log in again.",
    ].join("\n");
  }

  if (isCodeGenerated) {
    return [
      description,
      "Current Status: CODE GENERATED",
      `Access code valid until: ${new Date(
        user.state.admin!.codeValidUntil!
      ).toLocaleString()}`,
      `Please use the code and the login tool to gain admin access.`,
    ].join("\n");
  }

  return [
    description,
    "Current Status: CODE NOT GENERATED",
    "Please generate an admin access code to log in.",
  ].join("\n");
}

export const getAdminModeObject = () =>
  new Autonomous.Object({
    name: "admin",
    description: getAdminStatus(),
    tools: isUserAdmin() ? [indexKnowledgeBasesTool] : [getLoginTool()],
  });
