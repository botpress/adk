# Subagents Frontend

A React web interface with live subagent execution tracking.

See the [main README](../README.md) for full documentation.

## Quick Start

```bash
bun install
bun run dev
```

## Configuration

Update `src/config/constants.ts` with your webchat client ID after deploying the bot.

## Project Structure

```
src/
├── components/    # Message renderers & SubAgent cards
├── config/        # Bot configuration
├── context/       # React contexts
└── hooks/         # Custom hooks
```
