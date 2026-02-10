# Subagents

A multi-agent conversational AI system built with Botpress ADK using the **orchestrator-worker pattern**. This example demonstrates how to build specialized AI agents (subagents) that work together to handle different domains of user requests.

![Demo](./demo.gif)

## Use Case

When you need a single chatbot that handles multiple domains — HR, IT, Sales, Finance, Documentation — without becoming a monolithic prompt. Instead of cramming everything into one set of instructions, each domain gets its own specialist agent with scoped tools and knowledge. The user talks to one assistant; behind the scenes, the orchestrator routes to the right specialist and synthesizes the result.

This example shows how to build the orchestrator-worker pattern: dependency injection of `execute()` into subagents, worker mode for isolation, structured result passing via `Autonomous.Exit`, multi-turn information gathering through `needsInput`/`questions`, and real-time execution tracking in the frontend.

## How It Works

The conversation handler is the orchestrator — the only agent that talks to the user. When a message comes in, the orchestrator's AI decides whether to handle it directly (greetings, general questions) or delegate to a specialist subagent.

Each subagent runs in **worker mode** via a separate `execute()` call — it gets its own context window, can't see the conversation transcript, and can't send messages to the user. It does its work autonomously (calling its own tools, searching its own knowledge base) and returns a structured result via `Autonomous.Exit`. The orchestrator then presents that result naturally to the user, never revealing the multi-agent architecture.

If a subagent needs more information (e.g., "What's your employee ID?"), it returns `needsInput: true` with a list of questions. The orchestrator relays those questions to the user, then calls the subagent again with the answers in the `context` field — this is how multi-turn flows work without giving subagents direct user access.

The frontend tracks subagent execution in real-time: the `onTrace` hook inside `SubAgent.run()` emits custom messages for each thinking step and tool call, which the frontend groups by `executionId` and renders as collapsible SubAgentCards.

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│                                  User                                      │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                              Orchestrator                                  │
│  Routes requests to specialist agents and synthesizes responses            │
└────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────────┐
│ HR Agent │ │ IT Agent │ │  Sales   │ │ Finance  │ │     Docs Agent       │
│          │ │          │ │  Agent   │ │  Agent   │ │  (Knowledge Base)    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────────┘
```

## Project Structure

```
subagents/
├── bot/                  # Backend agent system (Botpress ADK)
│   └── src/
│       ├── conversations/    # Orchestrator conversation handler
│       ├── subagent/         # SubAgent framework
│       ├── agents/           # Specialist agents (HR, IT, Sales, Finance, Docs)
│       └── knowledge/        # Knowledge bases
│
├── frontend/             # Web UI (React + Vite)
│   └── src/
│       ├── components/       # Message renderers & SubAgent cards
│       ├── config/           # Bot configuration
│       └── hooks/            # React hooks
│
└── README.md             # This file
```

## Prerequisites

- [Bun](https://bun.sh) (or npm/pnpm)
- [Botpress ADK CLI](https://botpress.com/docs/adk)
- A Botpress account

## Quick Start

### 1. Setup the Bot

```bash
cd bot

# Install dependencies
bun install

# Login to Botpress (first time only)
adk login

# Link to a new bot in your workspace
adk link
# Select "Create new Bot" when prompted

# Start development server
adk dev
```

### 2. Test with CLI

In a new terminal:

```bash
cd bot
adk chat
```

Try asking:
- "I want to book vacation" (routes to HR agent)
- "Reset my password" (routes to IT agent)
- "What products do you have?" (routes to Sales agent)
- "What is a Botpress table?" (routes to Docs agent)

### 3. Setup the Frontend (Optional)

The frontend provides a web UI with live subagent execution tracking.

```bash
cd frontend

# Install dependencies
bun install

# Start Vite dev server
bun run dev
```

### 4. Connect Frontend to Bot

1. Deploy the bot:
   ```bash
   cd bot
   adk deploy
   ```

2. Get your webchat client ID from the Botpress Dashboard:
   - Go to your bot > Webchat integration > Copy the Client ID

3. Update `frontend/src/config/constants.ts`:
   ```typescript
   export const CLIENT_ID = "<YOUR_WEBCHAT_CLIENT_ID>" as const;
   ```

4. Refresh the frontend

## Key Components

### SubAgent Framework (`bot/src/subagent/`)

The reusable `SubAgent` class that wraps any specialist as an `Autonomous.Tool` for the orchestrator. Handles worker mode execution, trace-to-UI streaming, exit extraction, and the iteration-limit fallback. `asTool(execute, step)` is the dependency injection point — subagents are defined as standalone modules and wired to a conversation context at call time.

### Specialist Agents (`bot/src/agents/`)

Five domain agents (HR, IT, Sales, Finance, Docs) that each define their own tools and instructions. All tool handlers return mock data — the schemas are what matter for the pattern. The Docs agent is the exception: it has no tools, relying entirely on a knowledge base that gives the AI an auto-generated `search_knowledge` tool.

### Orchestrator (`bot/src/conversations/index.ts`)

The conversation handler that owns the user-facing conversation. Routes requests to subagents via `execute()` with all five agents as tools. Defines the channel-aware `step` callback that emits custom messages (webchat) or plain text (CLI) for execution tracking.

### Frontend Execution Tracking (`frontend/src/`)

`useSubAgentGroups` groups step messages by `executionId` into a Map. `useEnrichedMessages` filters out duplicate step messages (only "start" stays in the message list) and sorts the current turn by timestamp. `CustomTextRenderer` matches on url `"subagent"` and renders a `SubAgentCard` — a collapsible card showing the agent name, task, and all thinking/tool steps.

## Key Concepts

### Orchestrator Pattern

The main conversation handler (`bot/src/conversations/index.ts`) acts as an orchestrator:
- Routes user requests to specialist subagents
- Handles greetings and general questions directly
- Synthesizes subagent results into user-friendly responses
- Never exposes the multi-agent architecture to the user

### SubAgent Class

Each subagent (`bot/src/subagent/`) is a specialized agent that:
- Has its own instructions and tools
- Runs in **Worker Mode** (autonomous, no yielding to user)
- Returns structured results via an exit
- Can request more information via `needsInput: true`

### Dependency Injection

Subagents receive `execute` and `step` functions via dependency injection:

```typescript
// In orchestrator
tools: [
  hrAgent.asTool(execute, step),
  itAgent.asTool(execute, step),
  // ...
]
```

### Worker Mode

Subagents use `mode: "worker"` which means:
- No access to conversation transcript
- Cannot send messages directly to user
- Runs autonomously until exit or max iterations

## Adding a New Subagent

1. Create the agent file in `bot/src/agents/`:

```typescript
// bot/src/agents/support.ts
import { z, Autonomous } from "@botpress/runtime";
const { Tool } = Autonomous;
import { SubAgent } from "../subagent";

const createTicket = new Tool({
  name: "createTicket",
  description: "Create a support ticket",
  input: z.object({
    subject: z.string(),
    description: z.string(),
  }),
  output: z.object({
    ticketId: z.string(),
  }),
  handler: async ({ subject, description }) => ({
    ticketId: `TICKET-${Date.now()}`,
  }),
});

export const supportAgent = new SubAgent({
  name: "support",
  description: "Handle customer support requests and tickets",
  instructions: `You are a support specialist...`,
  tools: [createTicket],
});
```

2. Export from `bot/src/agents/index.ts`:

```typescript
export { supportAgent } from "./support";
```

3. Add to orchestrator in `bot/src/conversations/index.ts`:

```typescript
import { supportAgent } from "../agents";

// In execute():
tools: [
  // ...existing agents
  supportAgent.asTool(execute, step),
],
```

