# Parallel Document Processing — Frontend

React web interface for defining analyzers, uploading documents, reviewing AI-generated checks, and viewing analysis results.

See the [main README](../README.md) for full documentation.

## Quick Start

```bash
pnpm install
pnpm run dev     # Starts on port 5173
```

## Configuration

Copy `.env.example` to `.env` and set your bot's client ID (printed by `adk dev`):

```
VITE_CLIENT_ID=your-client-id-here
```

## Build

```bash
pnpm run build   # Outputs to dist/
pnpm run preview # Preview the production build
```

## Project Structure

```
src/
├── components/
│   ├── file-drop-zone.tsx         # Drag-and-drop file upload
│   ├── analyzer-sidebar.tsx       # Analyzer list + result cards
│   ├── analyzer-modal.tsx         # Create/edit analyzer dialog
│   ├── analyzer-card-item.tsx     # Status card (pending → analyzing → pass/fail)
│   ├── checks-modal.tsx           # Review and approve generated checks
│   └── ui/                        # shadcn/ui primitives
├── hooks/
│   └── use-analyzer-cards.ts      # Card lifecycle state management
├── lib/
│   ├── parse-message.ts           # Parses bot text messages into typed events
│   └── utils.ts                   # Tailwind merge utility
├── App.tsx                        # Main app — webchat events & state
└── types.ts                       # Analyzer, AnalyzerCard, CheckResult types
```
