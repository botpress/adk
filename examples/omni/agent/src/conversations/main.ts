/**
 * Main conversation handler for the omni agent
 *
 * This module provides the main entry point for handling chat messages.
 * It uses the real ADK Conversation class and creates the delegate tool
 * inside the handler where execute() is available for proper delegation.
 */

import { Conversation, z, Autonomous } from "@botpress/runtime";
import { join } from "path";
import { getAgent, resolveAgentInstructions } from "../agents/registry.js";
import { createToolsForAgent } from "../tools/registry.js";
import {
  createDelegateToolWithNestedSupport,
  type DelegateContext,
} from "../tools/definitions/delegate.js";
import type { ToolContext } from "../tools/types.js";
import type { AgentContext } from "../agents/types.js";
import { buildSystemHeader, buildSkillsSection } from "../lib/prompts.js";
import { buildSkillSnapshot } from "../skills/index.js";
import { syncSkillsFromLocalPlane } from "../skills/sync.js";
import { bootstrap } from "../index.js";

/**
 * Configuration for the conversation handler
 */
export type ConversationConfig = {
  localPlaneUrl?: string;
  localPlaneToken?: string;
  workspacePath?: string;
  soulMdPath?: string;
  agentsMdPath?: string;
};

/**
 * State tracked across conversation turns (Zod schema)
 */
const conversationStateSchema = z.object({
  contextLoaded: z.boolean().default(false),
  loadedContext: z
    .object({
      soul: z.string().optional(),
      agents: z.string().optional(),
      memory: z.string().optional(),
    })
    .optional(),
});

/**
 * State type derived from the schema
 */
export type ConversationState = z.infer<typeof conversationStateSchema>;

/**
 * Handler context provided by the ADK runtime (for manual usage)
 */
export type HandlerContext = {
  execute: Autonomous.ConvoExecuteFn;
  message: { text: string };
  state: ConversationState;
  config: ConversationConfig;
  sessionKey?: string;
};

/**
 * Main conversation using the real ADK Conversation class
 *
 * This integrates properly with the ADK runtime and creates the delegate tool
 * inside the handler where execute() is available for actual subagent execution.
 */
export const MainConversation = new Conversation({
  channel: "chat.channel", // Accept all channels
  state: conversationStateSchema,

  handler: async ({ execute, message, state, conversation }) => {
    // Initialize tool and agent registries (idempotent)
    bootstrap();

    // Build config for local-plane calls
    const config = {
      localPlaneUrl: process.env["LOCAL_PLANE_URL"],
      localPlaneToken: process.env["LOCAL_PLANE_TOKEN"],
      workspacePath: process.env["WORKSPACE_PATH"],
      soulMdPath: process.env["SOUL_MD_PATH"],
      agentsMdPath: process.env["AGENTS_MD_PATH"],
    };

    // Sync skills from local-plane to table
    try {
      await syncSkillsFromLocalPlane(config);
    } catch (error) {
      console.error("[omni] Failed to sync skills from local-plane:", error);
      // Continue even if sync fails - skills may already be in table
    }

    // Get the main agent definition
    const mainAgentDef = getAgent("main");
    if (!mainAgentDef) {
      throw new Error(
        "Main agent not registered. Ensure bootstrap() has been called.",
      );
    }

    // Build tool context - reuse config from above
    const toolContext: ToolContext = {
      agentId: "main",
      sessionKey: conversation.id,
      config,
    };

    // Create tools for the main agent (excluding delegate - we'll add it separately)
    const registryTools = createToolsForAgent(
      "main",
      mainAgentDef.tools,
      toolContext,
    ).filter((t) => t.name !== "delegate");

    const delegateContext: DelegateContext = {
      ...toolContext,
      delegationDepth: 0,
    };

    // Create delegate tool with nested delegation support
    const delegateTool = createDelegateToolWithNestedSupport(
      delegateContext,
      execute,
      // Recursive factory for nested delegation
      (subCtx, subExecute) =>
        createDelegateToolWithNestedSupport(subCtx, subExecute),
    );

    // Combine registry tools with the properly-configured delegate tool
    const tools = [...registryTools, delegateTool];

    // Build agent context
    const agentContext: AgentContext = {
      botState: state,
      loadedContext: state.loadedContext,
    };

    // Resolve instructions
    const instructions = resolveAgentInstructions(mainAgentDef, agentContext);

    // Load skills with compact XML format
    const skillsDir = toolContext.config.workspacePath
      ? join(toolContext.config.workspacePath, "skills")
      : join(process.cwd(), "skills");

    const skillSnapshot = buildSkillSnapshot({
      skillDirs: [skillsDir],
      checkRequirements: true,
    });

    // Build skills section with on-demand read instructions
    const skillsSection = skillSnapshot.prompt
      ? buildSkillsSection(skillSnapshot.prompt, "file_read")
      : "";

    // Add system header
    const systemHeader = buildSystemHeader("main", conversation.id);
    // Extract text from message payload - handle different payload types
    const payload = message?.payload as { text?: string } | undefined;
    const messageText = payload?.text ?? "";
    const fullInstructions = `${systemHeader}

${instructions}
${skillsSection}
${messageText ? `## Current Message\n\n${messageText}` : ""}`;

    // Execute with the ADK runtime
    await execute({
      model: mainAgentDef.model ?? "anthropic:claude-sonnet-4-20250514",
      instructions: fullInstructions,
      tools,
    });
  },
});

/**
 * Manual conversation handler for testing or custom integrations
 *
 * This provides the same logic as MainConversation but can be called
 * directly with a custom context object.
 */
export async function handleMainConversation(
  ctx: HandlerContext,
): Promise<Autonomous.ExecuteResult> {
  const { execute, message, state, config, sessionKey } = ctx;

  // Initialize tool and agent registries (idempotent)
  bootstrap();

  // Sync skills from local-plane to table
  try {
    await syncSkillsFromLocalPlane(config);
  } catch (error) {
    console.error("[omni] Failed to sync skills from local-plane:", error);
    // Continue even if sync fails - skills may already be in table
  }

  // Get the main agent definition
  const mainAgentDef = getAgent("main");
  if (!mainAgentDef) {
    throw new Error(
      "Main agent not registered. Ensure bootstrap() has been called.",
    );
  }

  // Build tool context
  const toolContext: ToolContext = {
    agentId: "main",
    sessionKey,
    config: {
      localPlaneUrl: config.localPlaneUrl,
      localPlaneToken: config.localPlaneToken,
      workspacePath: config.workspacePath,
      soulMdPath: config.soulMdPath,
      agentsMdPath: config.agentsMdPath,
    },
  };

  // Create tools for the main agent (excluding delegate)
  const registryTools = createToolsForAgent(
    "main",
    mainAgentDef.tools,
    toolContext,
  ).filter((t) => t.name !== "delegate");

  // Create delegate tool with execute function
  const delegateContext: DelegateContext = {
    ...toolContext,
    delegationDepth: 0,
  };

  const delegateTool = createDelegateToolWithNestedSupport(
    delegateContext,
    execute,
    (subCtx, subExecute) =>
      createDelegateToolWithNestedSupport(subCtx, subExecute),
  );

  const tools = [...registryTools, delegateTool];

  // Build agent context
  const agentContext: AgentContext = {
    botState: state,
    loadedContext: state.loadedContext,
  };

  // Resolve instructions
  const instructions = resolveAgentInstructions(mainAgentDef, agentContext);

  // Load skills with compact XML format
  const skillsDir = config.workspacePath
    ? join(config.workspacePath, "skills")
    : join(process.cwd(), "skills");

  const skillSnapshot = buildSkillSnapshot({
    skillDirs: [skillsDir],
    checkRequirements: true,
  });

  // Build skills section with on-demand read instructions
  const skillsSection = skillSnapshot.prompt
    ? buildSkillsSection(skillSnapshot.prompt, "file_read")
    : "";

  // Add system header
  const systemHeader = buildSystemHeader("main", sessionKey);
  const fullInstructions = `${systemHeader}

${instructions}
${skillsSection}
## Current Message

${message.text}`;

  // Execute with the ADK runtime
  return await execute({
    model: mainAgentDef.model ?? "anthropic:claude-sonnet-4-20250514",
    instructions: fullInstructions,
    tools,
  });
}
