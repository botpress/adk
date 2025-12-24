# Clause Extraction Agent

Extract and analyze contractual clauses from legal documents with party-aware risk assessment and deduplication.

## Demo

Try it live: **[https://clause.botpress.bot](https://clause.botpress.bot)**

## Features

- Upload PDF/DOCX contracts via webchat
- Party-aware analysis (asks which party user represents)
- RAG-powered passage extraction (Files API)
- Parallel clause extraction with Zai
- Reviewer pass for deduplication
- Risk assessment from user's perspective (high/medium/low)
- Real-time progress updates

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  EXTRACTION PIPELINE                                                │
│  Party Selection → Contract → Files API → RAG Index → Passages     │
│                                         ↓                           │
│  Zai Extract (party-aware risk) → Reviewer Pass → Clauses          │
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

### Party Selection

Before extraction, the bot asks which party the user represents:
- **Party A**: Service provider, vendor, or seller
- **Party B**: Client, customer, or buyer

Risk levels are then assessed from the user's perspective.

### Clause Structure

Each extracted clause contains:
- `clauseType` - Category (payment_terms, liability, etc.)
- `title` - Clause heading
- `section` - Section number if present
- `text` - Full verbatim text
- `keyPoints` - 3-5 key obligations/rights
- `riskLevel` - Risk from user's perspective (low/medium/high)

## Learn More

- [ADK Documentation](https://botpress.com/docs/adk)
- [Botpress Platform](https://botpress.com)
