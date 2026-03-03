# Parallel Document Processing

Run multiple AI analysis workflows simultaneously on a single document — each with its own criteria, user-reviewable checks, and independent results.

![Demo](demo.gif)

## Use Case

When you need to evaluate a document across several independent dimensions at once:

- Let users define custom analyzers with free-form instructions.
- Pause each workflow for human review before running the final analysis.
- Stream results back to the UI as each workflow completes independently.
- Example: run clarity, completeness, and accuracy checks on the same document in parallel.

This example shows how to build parallel durable workflows with user interruption using `step.request()` / `workflow.provide()`, and event-driven communication between the bot and a custom React frontend.

## How It Works

1. **Define analyzers** — the user creates one or more analyzers in the sidebar, each with a title and free-form instructions (e.g. "Check that all acronyms are defined on first use")
2. **Upload a document** — the conversation handler uploads the file via the Files API with `index: true`, waits for indexing, retrieves passage text, and starts one `AnalyzeDocumentWorkflow` instance per analyzer, all running in parallel
3. **Generate checks** — each workflow uses `zai.extract()` to convert the free-form instructions into 3–5 concrete yes/no questions
4. **Review checks** — each workflow pauses via `step.request()` and sends the generated checks to the frontend for user approval or editing
5. **Run analysis** — once the user confirms, each workflow resumes and runs `zai.check()` for every approved check against the document text
6. **Deliver results** — workflows complete independently, sending pass/fail results with explanations back to the frontend as they finish

Workflows run as independent instances keyed by analyzer ID — if one fails or times out, the others continue unaffected.

## Key Components

### Analysis Workflow (`bot/src/workflows/analyze-message.ts`)

A 3-step durable workflow that processes a single analysis dimension:

1. `generate-checks` — `zai.extract()` converts instructions into yes/no questions
2. `step.request("checks")` — pauses execution, waiting for user feedback
3. `run-checks` — iterates through approved checks with `zai.check()`, collecting results

### Conversation Handler (`bot/src/conversations/index.ts`)

Orchestrates the full lifecycle across 5 event types:

| Event               | What happens                                                                    |
| ------------------- | ------------------------------------------------------------------------------- |
| `upsertAnalyzer`    | Stores analyzer config in conversation state                                    |
| File message        | Uploads to Files API, extracts passage text, starts parallel workflow instances |
| `workflow_request`  | Forwards generated checks to the frontend for review                            |
| `confirmAnalysis`   | Resumes paused workflow with user-approved checks                               |
| `workflow_callback` | Sends completed results (or failure) to the frontend                            |

### Frontend (`frontend/src/`)

React + Vite app with shadcn/ui that manages analyzer creation, check review modals, and real-time result cards. Communicates with the bot via `@botpress/webchat-client` events.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)                                        │
│  Analyzer Sidebar ←→ ChecksModal ←→ Result Cards               │
│         │ sendEvent()                    ▲ on("message")        │
└─────────┼────────────────────────────────┼──────────────────────┘
          │                                │
┌─────────┼────────────────────────────────┼──────────────────────┐
│  CONVERSATION HANDLER                    │                      │
│  upsertAnalyzer → state                  │                      │
│  file → Files API (index) → passages → for each analyzer:       │
│         │                    AnalyzeDocumentWorkflow.getOrCreate │
│         │                          │                  │          │
│         │              ┌───────────┘    ┌─────────────┘         │
│         ▼              ▼                ▼                        │
│     ┌──────────┐  ┌──────────┐    ┌──────────┐                 │
│     │ Workflow  │  │ Workflow  │    │ Workflow  │  (parallel)    │
│     │ Analyzer₁ │  │ Analyzer₂ │    │ Analyzer₃ │               │
│     └──────────┘  └──────────┘    └──────────┘                 │
│  confirmAnalysis → workflow.provide("checks")                   │
│  workflow_callback → send results to frontend                   │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
parallel-document-processing/
├── bot/                          # ADK agent
│   ├── src/
│   │   ├── conversations/           # Event handler & workflow orchestration
│   │   ├── workflows/               # AnalyzeDocumentWorkflow (3-step)
│   │   └── utils/                   # Files API helpers (indexing, passages)
│   ├── agent.config.ts              # Models, events, integrations
│   └── package.json                 # axios, @botpress/runtime
├── frontend/                     # React UI
│   ├── src/
│   │   ├── components/              # FileDropZone, AnalyzerSidebar, Modals
│   │   ├── hooks/                   # useAnalyzerCards state management
│   │   ├── lib/                     # Bot message parser
│   │   └── App.tsx                  # Main app — events & state
│   └── package.json                 # React 19, Vite, shadcn/ui, webchat
├── demo.gif
└── README.md
```

## Prerequisites

- Bun
- Botpress ADK CLI (`bun add -g @botpress/adk`)
- A Botpress account

## Quick Start

### Bot

```bash
cd bot
bun install
adk dev        # Note the client ID in the output
```

### Frontend

```bash
cd frontend
pnpm install
pnpm run dev   # Starts on port 5173
```

After running `adk dev`, update the frontend with your bot's client ID:

```typescript
// frontend/.env
VITE_CLIENT_ID = "your-client-id-from-adk-dev";
```

## Key Concepts

### Parallel Workflow Instances

Each analyzer runs as an independent workflow instance, keyed by analyzer ID:

```typescript
await Promise.all(
  analyzerEntries.map(async ([id, analyzer]) => {
    const wf = await AnalyzeDocumentWorkflow.getOrCreate({
      key: id,
      input: { fileContent, title: analyzer.name, id, instructions: analyzer.instructions },
    });
    state.analyzers[id].workflow = wf;
  }),
);
```

### Workflow Interruption & Resumption

Workflows pause mid-execution to collect user feedback, then resume:

```typescript
// In the workflow — pause and wait
const { checks } = await step.request("checks", JSON.stringify({ id, checks }));

// In the conversation handler — resume with user input
await state.analyzers[id].workflow?.provide("checks", { checks });
```

### Document Ingestion via Files API

Documents are uploaded with `index: true`, then text is extracted from indexed passages:

```typescript
// Upload and index the file
const { file } = await client.uploadFile({
  key: `user-upload-${conversation.id}/${Date.now()}`,
  content,
  contentType,
  index: true,
  expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
});

// Wait for indexing, then retrieve passage text
const fileContent = await getFileText(file.id);
```

This supports any file type the Files API can index — not just PDFs.

### Structured AI Checks with Zai

Free-form instructions are converted to structured checks, then evaluated:

```typescript
// Generate yes/no questions from instructions
const generated = await adk.zai.extract(
  instructions,
  z.object({
    checks: z.array(z.string()),
  }),
);

// Evaluate each check against the document
const { output } = await adk.zai.check(fileContent, check).result();
```

### Event-Driven Communication

The frontend and bot communicate via webchat events rather than chat messages:

- **Frontend → Bot**: `sendEvent({ type: "upsertAnalyzer", ... })` and `sendEvent({ type: "confirmAnalysis", ... })`
- **Bot → Frontend**: Specially-formatted text messages parsed by the frontend (`Workflow Request`, `Workflow Completion`, `Workflow Failure`)

## Learn More

- [ADK Documentation](https://botpress.com/docs/for-developers/adk/overview)
- [Zai Library Guide](https://botpress.com/docs/for-developers/adk/concepts/zai)
- [Workflows](https://botpress.com/docs/for-developers/adk/concepts/workflows)
