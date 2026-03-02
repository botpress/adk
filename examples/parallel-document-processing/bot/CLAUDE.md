# Document Analysis ADK Example

This example demonstrates how to build a document analysis agent using the Botpress ADK. It showcases advanced patterns of the ADK, primarily **parallel workflows** and event-driven communication with webchat.

## Learning Objectives

After studying this example, you will understand how to:

1. **Use workflows to run processes in parallel**
2. **Interrupt and provide context to long-running tasks** - Through `step.request` and `step.provide()`
3. **Share state between bot and UI** - Custom messages for real-time updates

## Key Patterns to Study

| Pattern                        | Files                                  | Why It Matters                                       |
| ------------------------------ | -------------------------------------- | ---------------------------------------------------- |
| Workflow interruptions         | `bot/src/workflows/analyze-message.ts` | Shows how users can interact with long running tasks |
| Event-driven conversation loop | `bot/src/conversations/index.ts`       | Bot <-> frontend real-time updates                   |

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
pnpm install        # Install dependencies
pnpm run dev        # Start Vite dev server (port 5173)
```

After running `adk dev`, update the frontend config with your bot's client ID:

```typescript
// frontend/.env
export const VITE_CLIENT_ID = "your-client-id-from-botpress";
```

## Architecture

### Data Flow

1. **Define analyzers**: User defines parameters for AI workflows.
2. **Upload**: User sends document via webchat file upload.
3. **Workflows run**: Text extracted from the document is checked against the workflows that the user defines.
4. **Verify**: Parallel `zai.check()` for each analyzer.
5. **Update**: Bot updates custom message payload with progress

### Key Patterns

**Message Updates** (bot -> frontend):

```typescript
// the bot sends progress updates to the frontend
client.sendMessage({
  type: "text"
  payload: {
    text: "<specially formatted message>"
  }
});
```

**Frontend Communication**:

```typescript
// Frontend sends events to the bot using client.sendEvent()
// See: frontend/src/App.tsx
```

**Structured Checks with Zai**:

```typescript
// Verify against natural language conditions with zai.check()
const { output } = await adk.zai.check(input.fileContent, check).result();
```

## Project Structure

### Bot (`bot/`)

| File                               | Purpose                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `agent.config.ts`                  | ADK configuration (models, integrations)                                                                |
| `src/conversations/index.ts`       | Webchat handler, triggers workflow, Q&A tools                                                           |
| `src/workflows/analyze-message.ts` | Main analysis workflow. Contains zai check logic and reference on how to stop a workflow mid-execution. |

## Learn More

- [ADK Documentation](https://botpress.com/docs/for-developers/adk/overview)
- [Zai Library Guide](https://botpress.com/docs/for-developers/adk/concepts/zai)
- [Workflows](https://botpress.com/docs/for-developers/adk/concepts/workflows)
