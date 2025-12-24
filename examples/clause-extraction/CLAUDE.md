# Clause Extraction ADK Example

This example demonstrates how to build a contract clause extraction agent using the Botpress ADK. It showcases several advanced patterns including custom webchat messages, real-time progress updates, and document processing with AI.

## Learning Objectives

After studying this example, you will understand how to:

1. **Build real-time progress UIs** - Custom webchat messages + frontend polling pattern
2. **Process documents with AI** - Files API indexing, passage retrieval, Zai extraction
3. **Orchestrate long-running tasks** - Multi-phase workflows with `step()` and `step.map()`
4. **Share state between bot and UI** - Tables for persistence, custom messages for real-time updates
5. **Apply context-aware AI** - Party-aware risk assessment based on user context
6. **Organize ADK code** - Separation of concerns (constants, extraction logic, tools, tables)

## What This Example Demonstrates

- **Custom webchat messages** with real-time progress updates
- **Frontend polling pattern** for live UI updates during long-running tasks
- **Party-aware risk assessment** (asks which party the user represents)
- **Parallel batch LLM extraction** with smart passage batching
- **Workflow orchestration** with multiple phases
- **Tables** for state sharing between bot and UI
- **Zai library** for structured data extraction and text generation

## Key Patterns to Study

| Pattern | Files | Why It Matters |
|---------|-------|----------------|
| Single source of truth | `bot/src/utils/constants.ts` | Centralized enums prevent duplication |
| Custom message protocol | `bot/src/utils/progress-component.ts` | Bot→frontend real-time updates |
| Polling with context | `frontend/src/hooks/useExtractionPolling.ts` | Frontend receives bot updates |
| UI vs Data state | `frontend/src/context/*.tsx` | Separation of concerns |
| Security in tools | `bot/src/tools/clause-tools.ts` | userId filtering prevents data leakage |

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
npm install        # Install dependencies
npm run dev        # Start Vite dev server (port 5173)
```

After running `adk dev`, update the frontend config with your bot's client ID:

```typescript
// frontend/src/config/constants.ts
export const CLIENT_ID = "your-client-id-from-adk-dev";
```

## Architecture

### Data Flow

1. **Upload**: User sends contract via webchat file upload
2. **Party Selection**: Bot asks which party user represents (Party A/vendor or Party B/client)
3. **Index**: Files API indexes document with `index: true`
4. **Passages**: Retrieve chunked passages from RAG
5. **Extract**: Parallel `zai.extract()` on batched passages (concurrency: 3)
6. **Store**: Save clauses to database tables
7. **Summarize**: Generate executive summary using `zai.text()`
8. **Update**: Bot updates custom message payload with progress
9. **Poll**: Frontend polls every 1s, updates React context
10. **Render**: Progress card and side panel reflect latest state

### Key Patterns

**Custom Message Updates** (bot → frontend):
```typescript
// How the bot sends progress updates to the frontend
client.updateMessage({
  id: messageId,
  payload: {
    name: "extraction_progress",
    data: { progress, clauses, summary, ... }
  }
});
```

**Frontend Polling**:
```typescript
// Frontend polls for updates while extraction is in progress
// See: frontend/src/hooks/useExtractionPolling.ts
```

**Structured Extraction with Zai**:
```typescript
// Extract structured clause data from text
const clauses = await adk.zai.extract(passageText, ClauseSchema);
```

## Project Structure

### Bot (`bot/`)

| File | Purpose |
|------|---------|
| `agent.config.ts` | ADK configuration (models, integrations) |
| `src/conversations/index.ts` | Webchat handler, triggers workflow, Q&A tools |
| `src/workflows/extract-clauses.ts` | Main 5-phase extraction workflow |
| `src/workflows/inspect-passages.ts` | Utility workflow to inspect passage metadata |
| `src/utils/progress-component.ts` | Create/update custom webchat messages |
| `src/utils/extraction.ts` | Clause extraction logic with Zai |
| `src/utils/passage-batching.ts` | Smart batching by document sections |
| `src/tables/*.ts` | Table schemas (clauses, contracts, activity) |
| `src/tools/clause-tools.ts` | Reusable tools for querying/analyzing clauses |

### Frontend (`frontend/`)

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app with webchat integration |
| `src/hooks/useExtractionPolling.ts` | Polling loop for progress updates |
| `src/context/ExtractionDataContext.tsx` | Global state for extraction data |
| `src/components/ClauseExtractionCard.tsx` | Progress card shown in chat |
| `src/components/ClauseDetailPanel.tsx` | Side panel with clauses & summary |
| `src/components/ClauseDetailModal.tsx` | Full clause detail modal |
| `src/config/constants.ts` | Bot client ID configuration |

## Tables

The bot uses three tables:

- **`clausesTable`** - Extracted clauses with full-text search
- **`contractsTable`** - Contract metadata and executive summary
- **`extractionActivityTable`** - Activity timeline for UI updates

## Clause Types

13 supported types: `payment_terms`, `liability_limitation`, `indemnification`, `termination`, `confidentiality`, `force_majeure`, `warranties`, `governing_law`, `dispute_resolution`, `intellectual_property`, `assignment`, `amendment`, `other`

## Risk Assessment

Risk is assessed from the perspective of the party the user represents:

- **High** - Unfavorable to the user's party, requires attention
- **Medium** - Neutral or has some concerns
- **Low** - Favorable to the user's party

Before extraction, the bot asks which party the user represents:
- **Party A**: Service provider, vendor, or seller
- **Party B**: Client, customer, or buyer

## Citation & Source Traceability

Each extracted clause includes citation data linking it back to its source passage:

- **Page Number** - Which page the clause was found on
- **Source Passage** - The full original text from the document

This is critical for legal use cases where users need to verify extracted clauses against the original document.

**Data Flow**:
```
Passage (from Files API) → extractFromBatch() → RawClauseWithSource.citation → clausesTable → Frontend UI
```

**Frontend**: Click any clause to expand it, then click "Source Passage" to see the original text.

## Utility Workflows

### `inspect_passages` - Inspect Passage Metadata

A utility workflow for exploring what metadata the Files API provides on passages. Useful when building features that depend on passage structure.

**Trigger via MCP**:
```typescript
adk_start_workflow({
  workflow: "inspect_passages",
  payload: { fileId: "file_xxx", limit: 10 }
})
```

**Output**:
- `totalPassages` - Total passages in the document
- `samplePassages` - Array with id, contentPreview, contentLength, metadata
- `metadataFields` - Unique metadata keys found (e.g., `pageNumber`, `position`, `type`, `subtype`)
- `metadataStats` - Count of passages with each metadata key

This workflow demonstrates how to create typed workflows with input/output schemas and call the Files API.

## Customization Ideas

- Add more clause types for your domain
- Customize the extraction prompts in `src/utils/extraction.ts`
- Add clause comparison across multiple contracts
- Implement clause templates or standard language detection
- Add export to PDF/Word functionality

## Learn More

- [ADK Documentation](https://botpress.com/docs/for-developers/adk/overview)
- [Zai Library Guide](https://botpress.com/docs/for-developers/adk/concepts/zai)
- [Workflows](https://botpress.com/docs/for-developers/adk/concepts/workflows)
- [Tables](https://botpress.com/docs/for-developers/adk/concepts/tables)
