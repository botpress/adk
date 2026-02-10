import { adk, Autonomous, user, z } from "@botpress/runtime";
import { ThinkSignal } from "llmz";

/**
 * User state schema for admin mode, merged into agent.config.ts.
 * Persists per user across conversations via user.state.admin.
 *
 * - adminUtil: when admin access expires (null = not an admin)
 * - code: the current one-time login code (null = no code generated)
 * - codeValidUntil: when the code expires (null = no active code)
 */
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

/**
 * Admin-only tool that refreshes all knowledge bases in the project.
 * Uses adk.project.knowledge to access all registered KBs at runtime.
 */
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

/**
 * Returns a different login tool depending on where the user is in the auth flow.
 * If a valid code exists, returns loginWithCode. Otherwise, returns generateLoginCode.
 * This way the AI only sees the tool that makes sense for the current state.
 */
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

        // ThinkSignal is thrown (not returned) to give the AI instructions
        // without producing a tool result. The AI sees the message and can
        // decide how to respond — here, telling the user the code was wrong.
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

      // Code is logged to the Botpress dashboard console, not sent to the user.
      // The admin retrieves it from the dashboard — this keeps the code out of the chat.
      logCode(generatedCode);

      // ThinkSignal tells the AI what happened so it can relay instructions to the user
      throw new ThinkSignal(
        `An admin login code has been generated and has been logged in the developer console of the Botpress dashboard. Please login to the Botpress dashboard to retrieve the code.`
      );
    },
  });
};

// Checks if the user has an active (non-expired) admin session
function isUserAdmin() {
  return (
    user.state.admin?.adminUtil &&
    user.state.admin?.adminUtil !== null &&
    new Date(user.state.admin.adminUtil) > new Date()
  );
}

/**
 * Builds a description string that includes the current admin status.
 * This becomes the Autonomous.Object description, which the AI sees —
 * so the AI knows whether to offer login or admin tools.
 */
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

/**
 * Returns an Autonomous.Object — a namespace that groups related tools together
 * with a description the AI can read. Objects are re-evaluated each iteration
 * of the agent loop, so returning a fresh one here means the AI always sees
 * the current auth state and the right set of tools:
 * - Not authenticated → generateLoginCode or loginWithCode
 * - Authenticated admin → refreshKnowledgeBases
 */
export const getAdminModeObject = () =>
  new Autonomous.Object({
    name: "admin",
    description: getAdminStatus(),
    tools: isUserAdmin() ? [indexKnowledgeBasesTool] : [getLoginTool()],
  });
