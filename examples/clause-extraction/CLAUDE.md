# CLAUDE.md

This file provides guidance to Claude Code when working with this ADK example.

## Overview

Clause extraction agent that analyzes legal contracts using Files API + Zai. Demonstrates:
- Custom webchat messages with real-time updates
- Frontend polling pattern for progress tracking
- Party-aware risk assessment (asks which party user represents)
- Parallel batch LLM extraction with smart passage batching
- Tables for state sharing between bot and UI

## Commands

### Bot

```bash
cd bot
bun install        # Install dependencies
adk dev            # Start dev server
adk deploy         # Deploy to Botpress Cloud
```

### Frontend

```bash
cd frontend
npm install        # Install dependencies
npm run dev        # Start Vite dev server (port 5173)
npm run build      # Production build
```

## Architecture

### Data Flow

1. **Upload**: User sends contract via webchat file upload
2. **Party Selection**: Bot asks which party user represents (Party A/vendor or Party B/client)
3. **Index**: Files API indexes document with `index: true`
4. **Passages**: Retrieve chunked passages from RAG
5. **Extract**: Parallel `zai.extract()` on batched passages (concurrency: 3), risk assessed from user's perspective
6. **Update**: Bot updates custom message payload with progress
7. **Poll**: Frontend polls every 1s, updates React context
8. **Render**: Progress card and side panel reflect latest state

### Key Patterns

**Custom Message Updates** (bot → frontend):
```typescript
// bot/src/utils/progress-component.ts
client.updateMessage({
  id: messageId,
  payload: { name: "extraction_progress", data: { progress, clauses, ... } }
});
```

**Frontend Polling**:
```typescript
// frontend/src/hooks/useExtractionPolling.ts
// Polls GET /conversations/{id}/messages every 1s while in_progress
```

**Tables**:
- `extractionActivityTable` - Activity timeline (reading, extracting, done)
- `clausesTable` - Final extracted clauses (full-text searchable)
- `contractsTable` - Contract metadata

## Key Files

### Bot

| File | Purpose |
|------|---------|
| `src/conversations/index.ts` | Webchat handler, triggers workflow |
| `src/workflows/extract-clauses.ts` | Main extraction workflow |
| `src/utils/progress-component.ts` | Create/update custom messages |
| `src/utils/activity-helpers.ts` | Activity table CRUD |
| `src/tables/*.ts` | Table schemas |

### Frontend

| File | Purpose |
|------|---------|
| `src/hooks/useExtractionPolling.ts` | 1s polling loop |
| `src/context/ExtractionDataContext.tsx` | State management |
| `src/components/ClauseExtractionCard.tsx` | Progress card UI |
| `src/components/ClauseDetailPanel.tsx` | Side panel with clauses |
| `src/config/constants.ts` | Bot client ID config |

## Configuration

After running `adk dev`, update frontend config with bot client ID:

```typescript
// frontend/src/config/constants.ts
export const BOT_CONFIG = {
  clientId: "YOUR_BOT_CLIENT_ID", // From adk dev output
  ...
}
```

## Clause Types

13 supported types: `payment_terms`, `liability_limitation`, `indemnification`, `termination`, `confidentiality`, `force_majeure`, `warranties`, `governing_law`, `dispute_resolution`, `intellectual_property`, `assignment`, `amendment`, `other`

## Risk Levels

Risk is assessed from the perspective of the party the user represents:
- `high` - Unfavorable to the user's party, requires attention
- `medium` - Neutral or has some concerns
- `low` - Favorable to the user's party

## Party Selection

Before extraction, the bot asks which party the user represents:
- **Party A**: Service provider, vendor, or seller
- **Party B**: Client, customer, or buyer

This context is passed to the extraction prompt so risk levels reflect the user's perspective.
