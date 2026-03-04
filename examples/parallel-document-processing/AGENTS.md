# Document Analysis ADK Example

This example demonstrates how to build a document analysis agent using the Botpress ADK. It showcases advanced patterns of the ADK, primarily **parallel workflows**, **workflow interruption/resumption**, and **event-driven communication** between the bot and a custom React frontend.

## Learning Objectives

After studying this example, you will understand how to:

1. **Use workflows to run processes in parallel** — Multiple `AnalyzeDocumentWorkflow` instances run concurrently, one per analyzer
2. **Interrupt and resume long-running tasks** — `step.request()` pauses a workflow; `workflow.provide()` resumes it with user input
3. **Ingest documents via the Files API** — Upload with `index: true`, poll for indexing completion, read passages
4. **Communicate between bot and frontend via events** — Custom webchat events for bidirectional real-time updates

## Key Patterns to Study

| Pattern                     | Files                                      | Why It Matters                                                                                 |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| Parallel workflow instances | `bot/src/conversations/index.ts`           | Shows how to run N independent workflows simultaneously using `getOrCreate()` with unique keys |
| Workflow interruption       | `bot/src/workflows/analyze-message.ts`     | `step.request()` pauses the workflow and emits a `workflow_request` event to the conversation  |
| Workflow resumption         | `bot/src/conversations/index.ts`           | `workflow.provide()` sends user-approved data back to the paused workflow                      |
| Files API ingestion         | `bot/src/utils/files.ts`                   | Upload → poll indexing status → paginate passages → concatenate text                           |
| Event-driven conversation   | `bot/src/conversations/index.ts`           | 5 event types orchestrate the full lifecycle without polling                                   |
| Frontend message parsing    | `frontend/src/lib/parse-message.ts`        | Bot sends structured text; frontend parses it into typed events                                |
| Card state machine          | `frontend/src/hooks/use-analyzer-cards.ts` | `pending_checks` → `analyzing` → `success` / `failure` lifecycle                               |

## Architecture

### Data Flow

1. **Define analyzers** — User creates analyzers in the sidebar. Frontend sends `upsertAnalyzer` event to bot. Bot stores them in conversation state.
2. **Upload document** — User drops a file. Frontend uploads via webchat, bot receives a `file` message. Bot re-uploads to the Files API with `index: true`, waits for indexing, then reads all passages as text.
3. **Start parallel workflows** — For each analyzer in state, the conversation handler calls `AnalyzeDocumentWorkflow.getOrCreate({ key: analyzerId, ... })`. All workflows start simultaneously.
4. **Generate checks (per workflow)** — Each workflow uses `adk.zai.extract()` to convert the analyzer's free-form instructions into 3–5 yes/no questions.
5. **Pause for review (per workflow)** — Each workflow calls `step.request("checks", ...)` which pauses execution and emits a `workflow_request` event. The conversation handler forwards the checks to the frontend as a specially-formatted text message.
6. **User reviews checks** — Frontend renders a `ChecksModal` where the user can edit or approve the generated checks. On confirm, frontend sends a `confirmAnalysis` event.
7. **Resume and run checks (per workflow)** — Conversation handler calls `workflow.provide("checks", { checks })` to resume the workflow. The workflow runs `adk.zai.check()` for each approved check against the document text.
8. **Deliver results** — Each workflow completes and triggers a `workflow_callback` event. The conversation handler sends results to the frontend as a text message. Frontend parses it and updates the result card.

### Event Types

```
Frontend → Bot:
  webchat:trigger { type: "upsertAnalyzer", id, name, instructions }
  webchat:trigger { type: "confirmAnalysis", id, checks }
  file message (document upload)

Bot → Frontend (as text messages):
  "Workflow Request\n{json}"       — checks ready for review
  "Workflow Completion\nSuccess\n{json}" — analysis results
  "Workflow Failure\n{json}"       — workflow failed
```

## Project Structure

### Bot (`bot/`)

| File                               | Purpose                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `agent.config.ts`                  | ADK configuration — models (`best`), custom `upsertAnalyzer` event schema, webchat + chat integrations                                           |
| `src/conversations/index.ts`       | Main conversation handler. Orchestrates 5 event types: `upsertAnalyzer`, file upload, `workflow_request`, `confirmAnalysis`, `workflow_callback` |
| `src/workflows/analyze-message.ts` | 3-step durable workflow: generate checks → request user input → run checks. Uses `zai.extract()` and `zai.check()`                               |
| `src/utils/files.ts`               | Files API helpers: `waitForIndexing()` polls file status, `getFileText()` paginates all passages and concatenates content                        |

### Frontend (`frontend/`)

| File                                    | Purpose                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                           | Main app — manages analyzers, file upload, webchat connection, and event dispatch/listening                            |
| `src/lib/parse-message.ts`              | Parses 3 types of bot text messages (`Workflow Request`, `Workflow Completion`, `Workflow Failure`) into typed objects |
| `src/hooks/use-analyzer-cards.ts`       | State machine for analysis cards: `pending_checks` → `analyzing` → `success` / `failure`                               |
| `src/types.ts`                          | TypeScript interfaces: `Analyzer`, `AnalyzerCard`, `CheckResult`, `AnalyzerCardStatus`                                 |
| `src/components/file-drop-zone.tsx`     | Drag-and-drop file upload area                                                                                         |
| `src/components/analyzer-sidebar.tsx`   | Sidebar listing analyzers and active analysis cards                                                                    |
| `src/components/analyzer-modal.tsx`     | Dialog to create or edit an analyzer (title + instructions)                                                            |
| `src/components/checks-modal.tsx`       | Dialog to review, edit, and confirm AI-generated checks before analysis runs                                           |
| `src/components/analyzer-card-item.tsx` | Status card with color-coded state (pending, analyzing, success, failure)                                              |

## Quick Start

### Bot

```bash
cd bot
bun install        # Install dependencies
adk dev            # Start dev server (note the client ID in output)
```

### Frontend

```bash
cd frontend
pnpm install       # Install dependencies
pnpm run dev       # Start Vite dev server (port 5173)
```

After running `adk dev`, copy the client ID into `frontend/.env`:

```
VITE_CLIENT_ID=your-client-id-from-adk-dev
```

## Key Code Walkthrough

### Conversation Handler — Parallel Workflow Launch

When a file is uploaded, the handler uploads it to the Files API, extracts text from passages, then starts one workflow per analyzer:

```typescript
// Upload to Files API with indexing
const { file } = await client.uploadFile({
  key: `user-upload-${conversation.id}/${Date.now()}-${payload.title}`,
  content,
  contentType,
  index: true,
  expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
});

// Wait for indexing, then get all passage text
fileContent = await getFileText(file.id);

// Start one workflow per analyzer (all run in parallel)
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

### Workflow — Interrupt and Resume

The workflow pauses after generating checks, waiting for user input:

```typescript
// Step 1: Generate checks from instructions
const generated = await step("generate-checks", async () => {
  return await adk.zai.extract(
    prompt,
    z.object({
      checks: z.array(z.string()),
    }),
  );
});

// Step 2: Pause — emit workflow_request event to the conversation
const { checks } = await step.request(
  "checks",
  JSON.stringify({ id, checks: generated.checks }),
);

// Step 3: Run approved checks (resumes after user confirms)
const results = await step("run-checks", async () => {
  const checkResults = [];
  for (const check of checks) {
    const { output } = await adk.zai.check(input.fileContent, check).result();
    checkResults.push({
      check,
      passed: output.value,
      explanation: output.explanation,
    });
  }
  return checkResults;
});
```

### Files API Helpers

`waitForIndexing()` polls until the file is ready, then `getFileText()` paginates all passages:

```typescript
export async function getFileText(fileId: string): Promise<string> {
  await waitForIndexing(fileId);

  const allContent: string[] = [];
  let nextToken: string | undefined;

  do {
    const response = await innerClient.listFilePassages({
      id: fileId,
      limit: 200,
      nextToken,
    });
    for (const p of response.passages) {
      allContent.push(p.content);
    }
    nextToken = response.meta?.nextToken;
  } while (nextToken);

  return allContent.join("\n\n");
}
```

## Learn More

- [ADK Documentation](https://botpress.com/docs/for-developers/adk/overview)
- [Zai Library Guide](https://botpress.com/docs/for-developers/adk/concepts/zai)
- [Workflows](https://botpress.com/docs/for-developers/adk/concepts/workflows)
