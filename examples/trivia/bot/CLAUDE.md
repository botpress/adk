# Botpress ADK Project Context

This project is built with the **Botpress Agent Development Kit (ADK)** - a TypeScript-first framework for building AI agents.

## Quick Reference: Use the Botpress MCP Server

**IMPORTANT**: When working on this project, always search the Botpress documentation using the `mcp__botpress-docs__SearchBotpress` tool before making changes. The ADK has specific patterns and APIs that are well-documented.

## What is the ADK?

The ADK allows developers to build Botpress agents using **code instead of the Studio interface**. It provides:

- Project scaffolding with TypeScript
- Hot reloading development server (`adk dev`)
- Type-safe APIs and auto-generated types
- Build and deploy to Botpress Cloud

## ADK CLI

The ADK CLI is installed globally. You can run it using `adk <command>`.
Always use bash to run ADK. (`Bash(adk)`)
To install an integration: `adk install <integration>`
To generate types without running in dev mode: `adk build`

## Core Concepts

### 1. Agent Configuration (`agent.config.ts`)

The main configuration file defines:

- **Agent name and description**
- **Default models** for autonomous and zai operations
- **State schemas** (bot-level and user-level state using Zod)
- **Configuration variables** (encrypted, secure storage for API keys)
- **Integration dependencies** (webchat, chat, etc.)

```typescript
export default defineConfig({
  name: "my-agent",
  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b",
  },
  bot: { state: z.object({}) },
  user: { state: z.object({}) },
  dependencies: {
    integrations: {
      webchat: { version: "webchat@0.3.0", enabled: true },
    },
  },
});
```

### 2. Conversations (`src/conversations/`)

**Primary way agents handle user messages**. Each conversation handler:

- Responds to messages from specific channels
- Uses `execute()` to run autonomous AI logic
- Can access conversation state, send messages, and call tools

**Key Pattern**: The `execute()` function runs the agent's AI loop:

```typescript
export default new Conversation({
  channel: "webchat.channel",
  handler: async ({ execute, conversation, state }) => {
    await execute({
      instructions: "Your agent's instructions here",
      tools: [myTool1, myTool2],
      knowledge: [myKnowledgeBase],
    });
  },
});
```

### 3. Workflows (`src/workflows/`)

**Long-running processes** for complex, multi-step operations:

- Can run on schedules (cron syntax)
- Run independently or triggered by events
- NOT the same as Studio Workflows
- Use `step()` for durable execution (survives restarts)

```typescript
export default new Workflow({
  name: "periodic-indexing",
  schedule: "0 */6 * * *",
  handler: async ({ step }) => {
    await step("task-name", async () => {
      // Your logic here
    });
  },
});
```

**This Project**: Does not use workflows - guardrails run inline in the conversation handler.

### 4. Tools (`src/tools/`)

**AI-callable functions** that enable agents to perform actions:

- Must have clear name and description
- Use Zod schemas for input/output
- Can be passed to `execute()`

```typescript
export default new Autonomous.Tool({
  name: "searchDatabase",
  description: "Search the database",
  input: z.object({ query: z.string() }),
  output: z.object({ results: z.array(z.any()) }),
  handler: async ({ query }) => {
    // Tool logic
    return { results: [] };
  },
});
```

### 5. Knowledge Bases (`src/knowledge/`)

**RAG (Retrieval-Augmented Generation)** for providing context:

- Website scraping
- Document ingestion
- Can be passed to `execute()` via `knowledge` parameter

### 6. Actions (`src/actions/`)

**Reusable business logic** that can:

- Be called from anywhere (import `actions` from `@botpress/runtime`)
- Be converted to tools with `.asTool()`
- Encapsulate logic not tied to conversational flow

## Project Structure

```
agent.config.ts          # Main configuration
src/
  conversations/         # Message handlers (primary user interaction)
  workflows/            # Long-running processes
  tools/                # AI-callable functions
  actions/              # Reusable business logic
  knowledge/            # Knowledge bases for RAG
  triggers/             # Event-based triggers
  tables/               # Database tables
.botpress/              # Auto-generated types (DO NOT EDIT)
```

## Development Workflow

1. **Start dev server**: `adk dev` (http://localhost:3001 for console)
2. **Add integrations**: `adk add webchat@latest`
3. **Build**: `adk build`
4. **Deploy**: `adk deploy`
5. **Chat in CLI**: `adk chat`

## Key Patterns from Examples

### Multi-Agent Orchestrator Pattern (Subagents Example)

- **Orchestrator** talks to user, routes to specialists
- **Subagents** run in isolated contexts (separate `execute()` loops)
- Subagents return structured results, not full conversations
- Uses "worker mode" with `mode: "worker"` in execute

### Progress Tracking Pattern (This Project)

- Workflow sends progress updates via custom messages
- Frontend listens for custom message types
- State tracks workflow reference and message ID

## Best Practices

1. **Search Botpress docs first** - Use the MCP tool before implementing
2. **Keep tools focused** - Single responsibility per tool
3. **Use Zod schemas** with `.describe()` for clarity
4. **State management** - Minimize large variables in main workflow
5. **Type safety** - Run `adk dev` or `adk build` to regenerate types after config changes
6. **Conversations vs Workflows**:
   - Conversations: User interactions, real-time responses
   - Workflows: Background tasks, scheduled jobs, long-running processes

## Common APIs

### Conversation Handler

```typescript
handler: async ({
  execute, // Run autonomous AI loop
  conversation, // Send messages, manage conversation
  state, // Conversation state (persisted)
  message, // Incoming message
  client, // Botpress API client
}) => {};
```

### Execute Function

```typescript
await execute({
  instructions: "String or function returning instructions",
  tools: [tool1, tool2], // Optional tools
  knowledge: [kb1, kb2], // Optional knowledge bases
  exits: [customExit], // Optional custom exits
  hooks: { onTrace, onBeforeTool }, // Optional hooks
  mode: "worker", // Optional: autonomous until exit
  iterations: 10, // Max loops (default 10)
});
```

## Zai Library

**Zai** is an LLM utility library that provides a clean, type-safe API for common AI operations. It's designed to work seamlessly with the ADK and SDK to process LLM inputs and outputs programmatically.

### Importing Zai in ADK

In the ADK, Zai is available from `@botpress/runtime`:

```typescript
import { zai } from '@botpress/runtime'
```

The default model for Zai operations is configured in `agent.config.ts`:

```typescript
export default defineConfig({
  defaultModels: {
    autonomous: "cerebras:gpt-oss-120b",
    zai: "cerebras:gpt-oss-120b", // Model used for Zai operations
  },
})
```

### When to Use Zai

Use Zai when you need to:
- Extract structured data from unstructured text
- Answer questions from documents with source citations
- Verify Boolean conditions in content
- Summarize long text into concise summaries
- Generate text programmatically based on prompts

**Use Zai instead of `execute()` when**: You need deterministic, structured outputs for specific AI tasks (extraction, validation, summarization) rather than conversational interactions.

### Zai Methods

#### 1. `answer()` - Answer Questions with Citations

Answers questions from documents with intelligent source citations. Returns different response types based on the result.

```typescript
const documents = [
  'Botpress was founded in 2016.',
  'The company is based in Quebec, Canada.',
  'Botpress provides an AI agent platform.'
]

const result = await zai.answer(documents, 'When was Botpress founded?')

if (result.type === 'answer') {
  console.log(result.answer) // "Botpress was founded in 2016."
  console.log(result.citations) // Array of citations with source references
}
```

**When to use**: When you need to answer questions from a set of documents with traceable sources (e.g., custom RAG implementations, document Q&A).

#### 2. `extract()` - Extract Structured Data

Extracts structured data from unstructured input using Zod schemas.

```typescript
import { z } from '@botpress/runtime'

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number()
})

const input = "My name is John Doe, I'm 30 years old and my email is john@example.com"
const result = await zai.extract(input, userSchema)

console.log(result.output)
// { name: "John Doe", email: "john@example.com", age: 30 }
```

**When to use**: When you need to parse unstructured user input into structured data (e.g., form extraction from natural language, parsing contact information).

#### 3. `check()` - Verify Boolean Conditions

Verifies a condition against some input and returns a boolean with explanation.

```typescript
const email = "Get rich quick! Click here now!!!"
const { output } = await zai.check(email, 'is spam').result()

console.log(output.value) // true
console.log(output.explanation) // "This email contains typical spam indicators..."
```

**When to use**: When you need to validate content or make binary decisions (e.g., content moderation, intent verification, condition checking).

#### 4. `summarize()` - Summarize Text

Creates concise summaries of lengthy text to a desired length.

```typescript
const longArticle = "..." // Long article content

const summary = await zai.summarize(longArticle, {
  length: 100, // tokens
  prompt: 'key findings and main conclusions'
})

console.log(summary) // Concise summary focusing on key findings
```

**When to use**: When you need to condense long content (e.g., article summaries, transcript summaries, document overviews).

#### 5. `text()` - Generate Text

Generates text of the desired length according to a prompt.

```typescript
const generated = await zai.text('Write a welcome message for new users', {
  length: 50 // tokens
})

console.log(generated) // Generated welcome message
```

**When to use**: When you need to generate specific text content programmatically (e.g., dynamic content generation, templated responses).

### Response Methods

All Zai operations return a Response object with promise-like behavior and additional functionality:

```typescript
// Await the result directly
const result = await zai.extract(input, schema)

// Or use .result() for explicit promise handling
const { output } = await zai.check(content, 'is valid').result()
```

### Best Practices

1. **Use Zod schemas with descriptions** - Add `.describe()` to schema fields for better extraction accuracy
2. **Choose appropriate methods** - Use `answer()` for Q&A, `extract()` for parsing, `check()` for validation
3. **Configure the right model** - Set `defaultModels.zai` in `agent.config.ts` to balance cost and accuracy
4. **Handle response types** - `answer()` can return different types (answer, no_answer, etc.), handle appropriately

## This Project Specifically

**Demo Guardrails Agent** - Topic-focused conversation with guardrails:

- Uses `zai.check()` to verify conversation stays on topic (Botpress)
- Runs guardrail check asynchronously before each execution cycle
- Sends custom guardrail messages to frontend when triggered
- Agent recovers gracefully by redirecting user back to topic

### Key Files

- `agent.config.ts` - Agent configuration with webchat integration
- `src/conversations/index.ts` - Main conversation handler with guardrail logic

## When Making Changes

1. **Always search Botpress docs** using `mcp__botpress-docs__SearchBotpress`
2. **Check examples** at `/Users/sly/adk/examples` for patterns
3. **Regenerate types** after changing `agent.config.ts` (run `adk dev`)
4. **Test in dev mode** with hot reloading (`adk dev`)
5. **Follow TypeScript types** - They're auto-generated from integrations

## Resources

- [ADK Overview](https://botpress.com/docs/for-developers/adk/overview)
- [ADK Getting Started](https://botpress.com/docs/for-developers/adk/getting-started)
- [Project Structure](https://botpress.com/docs/for-developers/adk/project-structure)
- [Conversations](https://botpress.com/docs/for-developers/adk/concepts/conversations)
- [Workflows](https://botpress.com/docs/for-developers/adk/concepts/workflows)
