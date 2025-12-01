# Subagents Example

A multi-agent conversational AI system built with Botpress ADK using the **orchestrator-worker pattern**. This example demonstrates how to build specialized AI agents (subagents) that work together to handle different domains of user requests.

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

## Learn More

- [ADK Documentation](https://botpress.com/docs/adk)
- [Botpress Platform](https://botpress.com)
