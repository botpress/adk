# Botpress ADK Project Context

This project is built with the **Botpress Agent Development Kit (ADK)** - a TypeScript-first framework for building AI agents.

## Table of Contents

- [Quick Reference: Use the Botpress MCP Server](#quick-reference-use-the-botpress-mcp-server)
- [What is the ADK?](#what-is-the-adk)
- [ADK CLI](#adk-cli)
- [Core Concepts](#core-concepts)
  - [1. Agent Configuration](#1-agent-configuration-agentconfigts)
  - [2. Conversations](#2-conversations-srcconversations)
  - [3. Workflows](#3-workflows-srcworkflows)
  - [4. Tools](#4-tools-srctools)
  - [5. Knowledge Bases](#5-knowledge-bases-srcknowledge)
  - [6. Actions](#6-actions-srcactions)
  - [7. Zai Library](#7-zai-library)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Common APIs](#common-apis)
- [Advanced Autonomous Execution](#advanced-autonomous-execution)
- [State and Metadata Management](#state-and-metadata-management)
- [Advanced Table Operations](#advanced-table-operations)
- [Knowledge Base Operations](#knowledge-base-operations)
- [Advanced Conversation Patterns](#advanced-conversation-patterns)
- [Citations System](#citations-system)
- [When Making Changes](#when-making-changes)
- [Resources](#resources)

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

#### Advanced Workflow Step Methods

Beyond basic `step()`, workflows have powerful methods for complex orchestration:

**Parallel Processing:**

- `step.map()` - Process array items in parallel with concurrency control
- `step.forEach()` - Like map but for side effects (returns void)
- `step.batch()` - Process in sequential batches

```typescript
// Process items in parallel
const results = await step.map(
  'process-items',
  items,
  async (item, { i }) => processItem(item),
  { concurrency: 5, maxAttempts: 3 }
)

// Batch processing
await step.batch(
  'bulk-insert',
  records,
  async (batch) => database.bulkInsert(batch),
  { batchSize: 100 }
)
```

**Workflow Coordination:**

- `step.waitForWorkflow()` - Wait for another workflow to complete
- `step.executeWorkflow()` - Start and wait in one call

```typescript
const result = await step.executeWorkflow('run-child', ChildWorkflow, { input })
```

**Timing Control:**

- `step.sleep()` - Pause execution (< 10s in-memory, >= 10s uses listening mode)
- `step.sleepUntil()` - Sleep until specific time
- `step.listen()` - Pause and wait for external event

```typescript
await step.sleep('wait-5s', 5000)
await step.sleepUntil('wait-until-noon', new Date('2025-01-15T12:00:00Z'))
```

**Request Data from Conversation:**

```typescript
// In workflow
const { topic } = await step.request('topic', 'What topic should I research?')

// In conversation
if (isWorkflowDataRequest(event)) {
  await workflow.provide(event, { topic: userInput })
}
```

**Execution Control:**

- `step.fail()` - Mark workflow as failed
- `step.abort()` - Abort without failing
- `step.progress()` - Record progress checkpoint

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

### 7. Zai Library

**Zai** is an LLM utility library that provides a clean, type-safe API for common AI operations. It's designed to work seamlessly with the ADK and SDK to process LLM inputs and outputs programmatically.

#### Importing Zai in ADK

In the ADK, Zai is available from `@botpress/runtime`:

```typescript
import { adk } from '@botpress/runtime'
// then adk.zai.<method_name>
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

#### When to Use Zai

Use Zai when you need to:
- Extract structured data from unstructured text
- Answer questions from documents with source citations
- Verify Boolean conditions in content
- Summarize long text into concise summaries
- Generate text programmatically based on prompts

**Use Zai instead of `execute()` when**: You need deterministic, structured outputs for specific AI tasks (extraction, validation, summarization) rather than conversational interactions.

#### Zai Methods

**1. `answer()` - Answer Questions with Citations**

Answers questions from documents with intelligent source citations.

```typescript
const documents = [
  'Botpress was founded in 2016.',
  'The company is based in Quebec, Canada.',
]

const result = await zai.answer(documents, 'When was Botpress founded?')

if (result.type === 'answer') {
  console.log(result.answer) // "Botpress was founded in 2016."
  console.log(result.citations) // Array of citations with source references
}
```

**When to use**: When you need to answer questions from a set of documents with traceable sources (e.g., custom RAG implementations, document Q&A).

**2. `extract()` - Extract Structured Data**

Extracts structured data from unstructured input using Zod schemas.

```typescript
import { z, adk } from '@botpress/runtime'

const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  age: z.number()
})

const input = "My name is John Doe, I'm 30 years old and my email is john@example.com"
// zai.extract returns the extracted data DIRECTLY (not wrapped in { output: ... })
const result = await adk.zai.extract(input, userSchema)

console.log(result)
// { name: "John Doe", email: "john@example.com", age: 30 }
```

**When to use**: When you need to parse unstructured user input into structured data (e.g., form extraction from natural language, parsing contact information).

**3. `check()` - Verify Boolean Conditions**

Verifies a condition against some input and returns a boolean with explanation.

```typescript
const email = "Get rich quick! Click here now!!!"
const { output } = await zai.check(email, 'is spam').result()

console.log(output.value) // true
console.log(output.explanation) // "This email contains typical spam indicators..."
```

**When to use**: When you need to validate content or make binary decisions (e.g., content moderation, intent verification, condition checking).

**4. `summarize()` - Summarize Text**

Creates concise summaries of lengthy text to a desired length.

```typescript
const longArticle = "..." // Long article content

const summary = await zai.summarize(longArticle, {
  length: 100, // tokens
  prompt: 'key findings and main conclusions'
})
```

**When to use**: When you need to condense long content (e.g., article summaries, transcript summaries, document overviews).

**5. `text()` - Generate Text**

Generates text of the desired length according to a prompt.

```typescript
const generated = await zai.text('Write a welcome message for new users', {
  length: 50 // tokens
})
```

**When to use**: When you need to generate specific text content programmatically (e.g., dynamic content generation, templated responses).

#### Response Methods

All Zai operations return a Response object with promise-like behavior and additional functionality:

```typescript
// Await the result directly
const result = await zai.extract(input, schema)

// Or use .result() for explicit promise handling
const { output } = await zai.check(content, 'is valid').result()
```

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

## Examples

Official examples: https://github.com/botpress/adk/tree/main/examples

### subagents

**What you'll learn:** How to build a multi-agent system where an orchestrator delegates to specialists.

Shows the `SubAgent` pattern where each specialist (HR, IT, Sales, etc.) runs in its own context with `mode: "worker"`, returns structured results via custom exits, and reports progress through `onTrace` hooks.

### webchat-rag

**What you'll learn:** How to build a RAG assistant with scheduled indexing, guardrails, and admin features.

Shows `Autonomous.Object` for dynamic tool grouping, `onBeforeTool` hooks to enforce knowledge search before answering, scheduled workflows for KB refresh, and `ThinkSignal` for interrupting execution.

### deep-research

**What you'll learn:** How to build complex, long-running workflows with progress tracking.

Shows `step()` and `step.map()` for workflow phases, `Reference.Workflow` for conversation-workflow linking, Tables for activity tracking, and extensive Zai usage (`extract`, `answer`, `filter`, `text`).

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

## Advanced Autonomous Execution

### Autonomous Namespace

The `Autonomous` namespace provides powerful primitives for controlling LLM behavior:

#### Autonomous.Exit - Custom Exit Conditions

Define custom exits for autonomous execution loops:

```typescript
import { Autonomous, z } from '@botpress/runtime'

const AnswerExit = new Autonomous.Exit({
  name: 'answer',
  description: 'Return when you have the final answer',
  schema: z.object({
    answer: z.string(),
    confidence: z.number()
  })
})

const NoAnswerExit = new Autonomous.Exit({
  name: 'no_answer',
  description: 'No answer could be found'
})

const result = await execute({
  instructions: 'Research and answer the question',
  exits: [AnswerExit, NoAnswerExit],
  mode: 'worker' // Run until exit triggered
})

// ✅ CORRECT - Use result.is() and result.output
if (result.is(AnswerExit)) {
  console.log(result.output.answer)      // Type-safe access
  console.log(result.output.confidence)
} else if (result.is(NoAnswerExit)) {
  console.log('No answer found')
}

// ❌ WRONG - Don't use result.exit.name or result.exit.value
// if (result.exit?.name === 'answer') { ... }
```

#### Autonomous.ThinkSignal - Inject Context

Provide context to the LLM without continuing execution:

```typescript
const results = await fetchData()

if (!results.length) {
  throw new ThinkSignal('error', 'No results found')
}

// Inject formatted results into LLM context
throw new ThinkSignal('results ready', formatResults(results))
```

#### Autonomous.Object - Dynamic Tool Grouping

Group tools dynamically based on state:

```typescript
const adminTools = new Autonomous.Object({
  name: 'admin',
  description: user.isAdmin ? 'Admin tools available' : 'Login required',
  tools: user.isAdmin ? [refreshKB, manageBots] : [generateLoginCode]
})

await execute({
  objects: [adminTools]
})
```

### Execution Hooks

Full control over the autonomous execution loop:

```typescript
await execute({
  instructions: '...',
  hooks: {
    // Before tool execution - can modify input
    onBeforeTool: async ({ iteration, tool, input, controller }) => {
      console.log(`About to call ${tool.name}`)
      return { input: modifiedInput } // Optional: transform input
    },

    // After tool execution - can modify output
    onAfterTool: async ({ iteration, tool, input, output, controller }) => {
      console.log(`${tool.name} returned:`, output)
      return { output: modifiedOutput } // Optional: transform output
    },

    // Before code execution in iteration
    onBeforeExecution: async (iteration, controller) => {
      return { code: modifiedCode } // Optional: transform generated code
    },

    // When exit is triggered
    onExit: async (result) => {
      console.log('Exited with:', result)
    },

    // After each iteration completes
    onIterationEnd: async (iteration, controller) => {
      if (iteration > 5) {
        controller.abort() // Stop execution
      }
    },

    // On trace events (synchronous, non-blocking)
    onTrace: ({ trace, iteration }) => {
      if (trace.type === 'comment') {
        console.log('LLM thinking:', trace.comment)
      }
      if (trace.type === 'tool_call') {
        console.log('Calling:', trace.tool_name)
      }
    }
  }
})
```

**Hook use cases:**
- Logging and debugging
- Input/output validation and transformation
- Rate limiting tool calls
- Custom abort conditions
- Injecting dynamic context

## State and Metadata Management

### Tags - Key-Value Metadata

Track metadata for any entity (bot, user, conversation, workflow):

```typescript
import { TrackedTags } from '@botpress/runtime'

// Create tags instance
const tags = TrackedTags.create({
  type: 'bot', // or 'user' | 'conversation' | 'workflow'
  id: entityId,
  client: botClient,
  initialTags: { status: 'active' }
})

// Load from server
await tags.load()

// Modify tags
tags.tags = {
  ...tags.tags,
  lastSync: new Date().toISOString()
}

// Check if modified
if (tags.isDirty()) {
  await tags.save()
}

// Batch operations
await TrackedTags.saveAllDirty()
await TrackedTags.loadAll()
```

**Access via workflow instance:**

```typescript
workflow.tags = { status: 'processing' }
await workflow.save()
```

### Reference.Workflow - Typed Workflow References

Serialize workflow references in state that auto-hydrate on access:

```typescript
import { Reference, z } from '@botpress/runtime'

// In conversation state schema
state: z.object({
  research: Reference.Workflow('deep_research').optional()
  // or untyped: Reference.Workflow().optional()
})

// In handler - always a WorkflowInstance
handler: async ({ state }) => {
  if (state.research) {
    // state.research is typed WorkflowInstance
    console.log(state.research.status) // 'running' | 'completed' | etc
    console.log(state.research.output) // Typed output

    if (state.research.status === 'completed') {
      // Access completed workflow data
    }
  }
}
```

### Context Object - Runtime Access

Global context for accessing runtime information:

```typescript
import { context } from '@botpress/runtime'

// Get specific context
const client = context.get('client')
const citations = context.get('citations')
const logger = context.get('logger')

// Get all context
const { client, cognitive, logger, operation } = context.getAll()
```

**Available context properties:**
- `client` - Botpress API client
- `cognitive` - LLM access
- `logger` - Logging
- `operation` - Current operation info
- `citations` - Citation tracking
- `chat` - Chat interface
- `bot` - Bot tags and metadata
- `user` - User information
- `conversation` - Current conversation
- `message` - Incoming message
- `event` - Current event
- `workflow` - Current workflow
- `workflowControlContext` - Workflow control (abort, fail, restart)

### State Management

Access and modify tracked state:

```typescript
import { bot, user } from '@botpress/runtime'

// Bot state
bot.state.lastIndexed = new Date().toISOString()
bot.state.config = { theme: 'dark' }

// User state
user.state.preferences = { notifications: true }
user.state.lastActive = Date.now()
```

State persists automatically across executions.

## Advanced Table Operations

### Table Naming Rules

**IMPORTANT**: Tables have strict naming requirements:

```typescript
// ✅ CORRECT - Name must end with "Table"
export const MyDataTable = new Table({
  name: "mydataTable",  // Must end with "Table"
  columns: { ... }
});

// ❌ WRONG - Missing "Table" suffix
name: "mydata"
name: "my_data"
```

**Reserved column names** - Cannot use these as column names:
- `id` (auto-generated)
- `createdAt` (auto-generated)
- `updatedAt` (auto-generated)
- `computed`
- `stale`

```typescript
// ❌ WRONG - Using reserved column name
columns: {
  createdAt: z.string()  // Reserved!
}

// ✅ CORRECT - Use alternative name
columns: {
  savedAt: z.string()
}
```

### Auto-Registration

Files in `src/tables/` are **auto-registered** by the ADK. Do NOT re-export from index.ts:

```typescript
// src/tables/index.ts
// ❌ WRONG - Causes duplicate registration errors
export { MyTable } from "./myTable";

// ✅ CORRECT - Leave empty or add comment
// Tables are auto-registered from src/tables/*.ts files
```

Same applies to `src/conversations/`, `src/workflows/`, `src/triggers/`, etc.

Beyond basic CRUD, Tables support powerful query and manipulation features:

### Complex Filtering

Use logical operators and conditions:

```typescript
await MyTable.findRows({
  filter: {
    $and: [
      { status: 'open' },
      { priority: { $in: ['high', 'urgent'] } }
    ],
    $or: [
      { assignee: userId },
      { reporter: userId }
    ],
    title: { $regex: 'bug|error', $options: 'i' }
  }
})
```

**Filter operators:**
- `$eq`, `$ne` - Equal, not equal
- `$gt`, `$gte`, `$lt`, `$lte` - Comparisons
- `$in`, `$nin` - In array, not in array
- `$exists` - Field exists
- `$regex` - Regular expression match
- `$options` - Regex options (e.g., 'i' for case-insensitive)
- `$and`, `$or` - Logical operators

### Full-Text Search

Search across searchable columns:

```typescript
await MyTable.findRows({
  search: 'query string',
  filter: { status: 'active' }
})
```

Mark columns as searchable in schema:

```typescript
columns: {
  title: z.string().searchable(),
  description: z.string().searchable()
}
```

### Aggregation and Grouping

Group and aggregate data:

```typescript
await MyTable.findRows({
  group: {
    status: 'count',
    priority: ['sum', 'avg'],
    complexity: ['max', 'min']
  }
})
```

**Aggregation operations:** `key`, `count`, `sum`, `avg`, `max`, `min`, `unique`

### Computed Columns

Columns with values computed from row data:

```typescript
columns: {
  fullName: {
    computed: true,
    schema: z.string(),
    dependencies: ['firstName', 'lastName'],
    value: async (row) => `${row.firstName} ${row.lastName}`
  },
  age: {
    computed: true,
    schema: z.number(),
    dependencies: ['birthDate'],
    value: async (row) => {
      const today = new Date()
      const birth = new Date(row.birthDate)
      return today.getFullYear() - birth.getFullYear()
    }
  }
}
```

### Upsert Operations

Insert or update based on key column:

```typescript
await MyTable.upsertRows({
  rows: [
    { externalId: '123', name: 'Item 1' },
    { externalId: '456', name: 'Item 2' }
  ],
  keyColumn: 'externalId', // Update if exists, insert if not
  waitComputed: true // Wait for computed columns to update
})
```

### Bulk Operations

Efficient batch operations:

```typescript
// Delete by filter
await MyTable.deleteRows({
  filter: { status: 'archived', createdAt: { $lt: '2024-01-01' } }
})

// Delete by IDs
await MyTable.deleteRowIds([1, 2, 3])

// Delete all
await MyTable.deleteAllRows()

// Update multiple
await MyTable.updateRows({
  rows: [
    { id: 1, status: 'active' },
    { id: 2, status: 'inactive' }
  ],
  waitComputed: true
})
```

### Error Handling

Collect errors and warnings from bulk operations:

```typescript
const { errors, warnings } = await MyTable.createRows({
  rows: data,
  waitComputed: true
})

if (errors?.length) {
  console.error('Failed rows:', errors)
}
if (warnings?.length) {
  console.warn('Warnings:', warnings)
}
```

## Knowledge Base Operations

### Data Sources

Multiple source types for knowledge bases:

#### Directory Source

```typescript
import { DataSource } from '@botpress/runtime'

const docs = DataSource.Directory.fromPath('src/knowledge', {
  id: 'docs',
  filter: (path) => path.endsWith('.md') || path.endsWith('.txt')
})
```

#### Website Source

```typescript
const siteDocs = DataSource.Website.fromSitemap('https://example.com/sitemap.xml', {
  id: 'website',
  maxPages: 500,
  fetch: 'node:fetch' // or custom fetch implementation
})
```

### Knowledge Base Definition

```typescript
import { Knowledge } from '@botpress/runtime'

export default new Knowledge({
  name: 'docs',
  description: 'Product documentation',
  sources: [docsDirectory, websiteSource]
})
```

### Refresh Operations

Manually refresh knowledge base content:

```typescript
// Refresh entire knowledge base
await DocsKB.refresh({ force: true })

// Refresh specific source
await DocsKB.refreshSource('website', { force: true })
```

**Options:**
- `force: true` - Force refresh even if recently updated
- Automatic refresh via scheduled workflows recommended

### Using Knowledge in Execute

```typescript
await execute({
  instructions: 'Answer using the documentation',
  knowledge: [DocsKB, APIKB],
  tools: [searchTool]
})
```

Knowledge bases are automatically searchable via the `search_knowledge` tool.

## Advanced Conversation Patterns

### Multiple Channel Support

Handle messages from multiple channels in one handler:

```typescript
export default new Conversation({
  channel: ['chat.channel', 'webchat.channel', 'slack.dm'],
  handler: async ({ channel, execute }) => {
    console.log(`Message from: ${channel}`)
    await execute({ instructions: '...' })
  }
})
```

### Event Handling

Subscribe to integration events:

```typescript
export default new Conversation({
  channel: 'webchat.channel',
  events: ['webchat:conversationStarted', 'webchat:conversationEnded'],
  handler: async ({ type, event, message }) => {
    if (type === 'event' && event.type === 'webchat:conversationStarted') {
      // Send welcome message
      await conversation.send({
        type: 'text',
        payload: { text: 'Welcome!' }
      })
    }

    if (type === 'message' && message?.type === 'text') {
      // Handle regular messages
      await execute({ instructions: '...' })
    }
  }
})
```

### Workflow Request Handling

Handle data requests from workflows:

```typescript
import { isWorkflowDataRequest } from '@botpress/runtime'

handler: async ({ type, event, execute }) => {
  // Check if this is a workflow requesting data
  if (type === 'workflow_request' && isWorkflowDataRequest(event)) {
    const userInput = await promptUser(event.payload.message)

    // Provide data back to workflow
    await workflow.provide(event, { topic: userInput })
    return
  }

  // Regular message handling
  await execute({ instructions: '...' })
}
```

### Typed Workflow Interactions

Work with typed workflow instances:

```typescript
import { isWorkflow, ResearchWorkflow } from '@botpress/runtime'

handler: async ({ state }) => {
  if (state.research && isWorkflow(state.research, 'research')) {
    // state.research is now typed as ResearchWorkflow
    console.log(state.research.status)
    console.log(state.research.output) // Typed output

    if (state.research.status === 'completed') {
      await conversation.send({
        type: 'text',
        payload: { text: state.research.output.result }
      })
    }
  }
}
```

### Dynamic Tools Based on State

Provide different tools based on conversation state:

```typescript
handler: async ({ state, execute }) => {
  const tools = () => {
    if (state.workflowRunning) {
      return [cancelWorkflowTool, checkStatusTool]
    } else {
      return [startWorkflowTool, browseTool, searchTool]
    }
  }

  await execute({
    instructions: '...',
    tools: tools()
  })
}
```

### Message Sending

Send different message types:

```typescript
// Text message
await conversation.send({
  type: 'text',
  payload: { text: 'Hello!' }
})

// Custom message type (integration-specific)
await conversation.send({
  type: 'custom:messageType',
  payload: { data: 'custom payload' }
})
```

## Citations System

Track and manage source citations for LLM responses:

### CitationsManager

Access via context:

```typescript
import { context } from '@botpress/runtime'

const citations = context.get('citations')
```

### Registering Sources

Register sources that can be cited:

```typescript
// Register with URL
const { tag } = citations.registerSource({
  url: 'https://example.com/doc',
  title: 'Documentation Page'
})

// Register with file reference
const { tag } = citations.registerSource({
  file: fileKey,
  title: 'Internal Document'
})
```

### Using Citation Tags

Inject citation tags into LLM content:

```typescript
const results = await searchKnowledgeBase(query)

for (const result of results) {
  const { tag } = citations.registerSource({
    file: result.file.key,
    title: result.file.name
  })

  content += `${result.content} ${tag}\n`
}

// Return cited content
throw new ThinkSignal('results', content)
```

### Citation Format

Citations are automatically formatted with tags like `[1]`, `[2]`, etc., and tracked by the system for reference.

### Example: Tool with Citations

```typescript
export default new Autonomous.Tool({
  name: 'search_docs',
  description: 'Search documentation',
  handler: async ({ query }) => {
    const citations = context.get('citations')
    const results = await searchDocs(query)

    let response = ''
    for (const doc of results) {
      const { tag } = citations.registerSource({
        url: doc.url,
        title: doc.title
      })
      response += `${doc.content} ${tag}\n\n`
    }

    return response
  }
})
```

## Common Mistakes to Avoid

### 1. Wrong Zai Import
```typescript
// ❌ WRONG
import { zai } from '@botpress/runtime'
const result = await zai.extract(...)

// ✅ CORRECT
import { adk } from '@botpress/runtime'
const result = await adk.zai.extract(...)
```

### 2. Expecting `.output` from zai.extract
```typescript
// ❌ WRONG - zai.extract returns data directly
const result = await adk.zai.extract(input, schema)
console.log(result.output)  // undefined!

// ✅ CORRECT
const result = await adk.zai.extract(input, schema)
console.log(result)  // { name: "John", age: 30 }
```

### 3. Wrong Exit Result Handling
```typescript
// ❌ WRONG
if (result.exit?.name === 'my_exit') {
  const data = result.exit.value
}

// ✅ CORRECT
if (result.is(MyExit)) {
  const data = result.output  // Type-safe!
}
```

### 4. Reserved Table Column Names
```typescript
// ❌ WRONG - These are reserved
columns: {
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
}

// ✅ CORRECT - Use alternatives
columns: {
  visibleId: z.string(),
  savedAt: z.string(),
  modifiedAt: z.string()
}
```

### 5. Re-exporting Auto-Registered Files
```typescript
// ❌ WRONG - src/tables/index.ts
export { MyTable } from "./myTable"  // Causes duplicates!

// ✅ CORRECT - Leave index.ts empty
// Files in src/tables/, src/conversations/, etc. are auto-registered
```

### 6. Table Name Missing "Table" Suffix
```typescript
// ❌ WRONG
name: "users"
name: "user_data"

// ✅ CORRECT
name: "usersTable"
name: "userdataTable"
```

## When Making Changes

1. **Always search Botpress docs** using `mcp__botpress-docs__SearchBotpress`
2. **Check examples** for patterns
3. **Regenerate types** after changing `agent.config.ts` (run `adk dev`)
4. **Test in dev mode** with hot reloading (`adk dev`)
5. **Follow TypeScript types** - They're auto-generated from integrations

## Running Tests

The ADK provides `setupTestRuntime()` to initialize the full ADK runtime within your test process. This sets up all environment variables, generates types, and imports the runtime so your tests can use actions, tools, workflows, etc.

### Bun Test

```toml
# bunfig.toml
[test]
preload = ["./test-setup.ts"]
```

```typescript
// test-setup.ts
import { beforeAll } from "bun:test";
import { setupTestRuntime } from "@botpress/adk";

beforeAll(async () => {
  const runtime = await setupTestRuntime();
  await runtime.initialize();
});
```

### Vitest

```typescript
// vitest.setup.ts
import { beforeAll } from "vitest";
import { setupTestRuntime } from "@botpress/adk";

beforeAll(async () => {
  const runtime = await setupTestRuntime();
  await runtime.initialize();
});
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

### Options

`setupTestRuntime()` auto-detects project path and credentials, but you can override:

```typescript
const runtime = await setupTestRuntime({
  projectPath: "/path/to/agent", // defaults to auto-detect from CWD
  credentials: { token: "...", apiUrl: "..." }, // defaults to ~/.adk/credentials
  prod: true, // use production bot instead of dev bot
  forceRegenerate: true, // force regenerate bot project
  env: { CUSTOM_VAR: "value" }, // additional env vars
});
```

### Prerequisites

- Must have `@botpress/adk` installed as a dev dependency (`bun add -d @botpress/adk`)
- Must have run `adk dev` at least once (to create the dev bot)
- Must be logged in (`adk login`) or provide credentials explicitly

## Resources

- [ADK Overview](https://botpress.com/docs/for-developers/adk/overview)
- [ADK Getting Started](https://botpress.com/docs/for-developers/adk/getting-started)
- [Project Structure](https://botpress.com/docs/for-developers/adk/project-structure)
- [Conversations](https://botpress.com/docs/for-developers/adk/concepts/conversations)
- [Workflows](https://botpress.com/docs/for-developers/adk/concepts/workflows)
