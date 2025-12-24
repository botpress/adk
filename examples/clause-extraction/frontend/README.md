# Clause Extraction Frontend

React web interface with real-time extraction progress and clause visualization.

See the [main README](../README.md) for full documentation.

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

Update `src/config/constants.ts` with your bot's client ID after deploying.

## Project Structure

```
src/
├── components/
│   ├── ClauseExtractionCard.tsx      # Progress card in chat
│   ├── ClauseDetailPanel.tsx         # Side panel with activities & clauses
│   ├── ClauseDetailModal.tsx         # Full clause detail modal
│   └── CustomMessageRenderer.tsx     # Custom message routing
├── context/
│   ├── ExtractionContext.tsx         # UI state (panel open/closed)
│   └── ExtractionDataContext.tsx     # Data cache from polling
├── hooks/
│   └── useExtractionPolling.ts       # 1s polling while in_progress
├── types/
│   └── extraction.ts                 # TypeScript types
└── config/
    └── constants.ts                  # Bot client ID config
```

## Key Pattern

1. **Polling**: `useExtractionPolling` checks messages every 1s while `status === "in_progress"`
2. **Context**: ExtractionDataContext caches latest extraction data by messageId
3. **Custom Blocks**: Routes `custom://extraction_progress` to ClauseExtractionCard
