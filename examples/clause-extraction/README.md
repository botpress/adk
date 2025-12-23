# Clause Extraction Agent

Extract and analyze contractual clauses from legal documents with risk assessment and deduplication.

## Features

- Upload PDF/DOCX contracts via webchat
- RAG-powered passage extraction (Files API)
- Parallel clause extraction with Zai
- Reviewer pass for deduplication
- Risk assessment (high/medium/low)
- Real-time progress updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXTRACTION PIPELINE                                                │
│  Contract → Files API → RAG Index → Passages → Zai Extract (x10)   │
│                                         ↓                           │
│                              Reviewer Pass → Consolidated Clauses   │
└─────────────────────────────────────────┬───────────────────────────┘
                                          │
┌─────────────────────────────────────────┼───────────────────────────┐
│  BOT (ADK)                              ↓                           │
│  Tables (activities, clauses) ←→ Custom Message (updateMessage)    │
└─────────────────────────────────────────┬───────────────────────────┘
                                          │ Webchat API (poll 1s)
┌─────────────────────────────────────────┼───────────────────────────┐
│  FRONTEND (React)                       ↓                           │
│  useExtractionPolling → Context → Research Card + Side Panel       │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
clause-extraction/
├── bot/                 # ADK agent
│   ├── src/
│   │   ├── conversations/  # Webchat handlers
│   │   ├── workflows/      # Extraction workflow
│   │   ├── tables/         # Activity, clauses, contracts
│   │   └── utils/          # Progress component helpers
│   └── agent.config.ts
├── frontend/            # React UI
│   ├── src/
│   │   ├── components/     # Card, Panel, Modal
│   │   ├── hooks/          # useExtractionPolling
│   │   └── context/        # ExtractionDataContext
│   └── vite.config.ts
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
adk dev
```

### Frontend

```bash
cd frontend
npm install
# Update src/config/constants.ts with your bot's client ID
npm run dev
```

## Key Concepts

### Custom Message Updates

Bot sends progress via `createMessage`/`updateMessage` with custom payload:

```typescript
client.createMessage({
  type: "custom",
  payload: { name: "extraction_progress", data: { progress, status, ... } }
});
```

### Frontend Polling

React polls messages every 1s while `status === "in_progress"`.

### Tables for State

- `extractionActivityTable` - Progress log
- `clausesTable` - Extracted clauses (searchable)
- `contractsTable` - Contract metadata

## Learn More

- [ADK Documentation](https://botpress.com/docs/adk)
- [Botpress Platform](https://botpress.com)
