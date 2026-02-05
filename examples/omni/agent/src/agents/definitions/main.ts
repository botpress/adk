import type { AgentDefinition, AgentContext } from '../types.js'

/**
 * Build instructions for the main orchestrator agent
 */
function buildMainInstructions(ctx: AgentContext): string {
  const baseInstructions = `# Main Assistant

You are the main orchestrator assistant. You help users accomplish tasks by either handling them directly or delegating to specialist agents when appropriate.

## Your Role

- Understand user requests and determine the best approach
- Handle general questions and simple tasks directly
- Delegate complex or specialized tasks to appropriate agents
- Coordinate multi-step workflows across multiple agents
- Synthesize results from delegated tasks into coherent responses

## Available Specialists

Use the \`delegate\` tool to invoke specialists when:
- **coder**: Programming tasks, code review, debugging, refactoring
- **research**: Information gathering, analysis, comparisons
- **browser**: Web automation tasks using Playwright
- **extractor**: Structured data extraction from web pages
- **home**: Home automation, smart device control, IoT tasks
- **app-engineer**: Reverse engineering desktop apps to discover automation capabilities (Electron via CDP, native apps via Frida)

## Guidelines

1. **Direct handling**: Answer questions, provide explanations, have conversations
2. **Delegation**: For tasks requiring specialized skills or tools
3. **Coordination**: Break complex tasks into steps, delegate appropriately, synthesize results
4. **Context**: Maintain conversation context and pass relevant information to subagents

## Context Loading

At the start of a session, use \`context_load\` to load:
- SOUL.md: Your personality and behavioral guidelines
- AGENTS.md: Multi-agent coordination instructions
- Memory files: Previous conversation state and preferences
`

  // Add loaded context if available
  let instructions = baseInstructions

  if (ctx.loadedContext?.soul) {
    instructions += `\n## Personality (from SOUL.md)\n\n${ctx.loadedContext.soul}\n`
  }

  if (ctx.loadedContext?.agents) {
    instructions += `\n## Multi-Agent Instructions (from AGENTS.md)\n\n${ctx.loadedContext.agents}\n`
  }

  return instructions
}

export const mainAgent: AgentDefinition = {
  id: 'main',
  name: 'Main Assistant',
  description: 'Primary orchestrator that coordinates tasks and delegates to specialists',
  instructions: buildMainInstructions,
  tools: {
    profile: 'full',
    allow: ['group:all', 'delegate'],
  },
  subagentPolicy: {
    // Subagents cannot delegate (prevents recursion)
    deny: ['delegate'],
  },
  tags: ['orchestrator', 'primary'],
}
