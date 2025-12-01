# Subagents Bot

The backend agent system for the subagents example.

See the [main README](../README.md) for full documentation.

## Quick Start

```bash
bun install
adk login
adk link
adk dev
```

## Project Structure

```
src/
├── conversations/    # Main orchestrator
├── subagent/         # SubAgent framework
├── agents/           # Specialist agents (HR, IT, Sales, Finance, Docs)
├── knowledge/        # Knowledge bases
└── utils/            # Utilities
```
