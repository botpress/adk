# Fallback Chain

A pattern for gracefully degrading across multiple data sources when primary APIs fail, using a prompt-driven strategy chain with the Botpress ADK.

## Demo

![Demo](./demo.gif)

## Use Case

When building AI agents that depend on external APIs, any single source can be unavailable, rate-limited, or return incomplete data. This example demonstrates how to implement a **fallback chain** that:

- Tries a primary data source first, and automatically escalates on failure
- Falls through a sequence of backup sources (secondary API, local cache, web search)
- Collects missing user input only when the last-resort strategy requires it
- Keeps a local cache warm in the background so fallback data is always fresh

## How It Works

Each incoming message runs through an ordered **strategy chain** defined in `src/config/fallbackStrategies.ts`. The `generateInstructions()` utility serializes the full chain — labeling each step as `[TRIED]`, `[CURRENT]`, or `[PENDING]` — into the system prompt on every turn.

The LLM receives all four strategy tools at once via `execute()` and is instructed to call them in order: succeed and stop, or fail and move to the next. This means the fallback logic lives entirely in the prompt and strategy config — no conditional branching in handler code.

The four strategies in order:

1. **mainAPI** — calls `fetchFlightById` against the primary REST API
2. **backupAPI** — calls `fetchBackupFlight` against a secondary REST API
3. **cacheTable** — calls `searchCacheTable` to look up a locally persisted cache
4. **citySearch** — calls `serpFlightSearch` with IATA airport codes; since this requires departure and arrival airports the user may not have provided, the strategy sets `requiresUserInput: true` and the handler waits for that input before proceeding

A scheduled `Workflow` runs every minute in the background, fetching FL001–FL010 from the main API and upserting them into `flightCacheTable`, so strategy 3 always has recent data to fall back to.

## Key Components

### Strategy Configuration (`src/config/fallbackStrategies.ts`)

Each strategy is a validated object describing which tool to call, what to tell the LLM, and what to do on failure:

```typescript
export const StrategySchema = z.object({
  name:              z.string(),
  toolName:          z.string(),
  description:       z.string(),
  instruction:       z.string(),
  onFailure:         z.enum(["next", "stop"]).default("next"),
  requiresUserInput: z.boolean().default(false),
  requiredFields:    z.array(z.string()).optional(),
  enabled:           z.boolean().default(true),
});

export const fallbackStrategies = {
  systemPrompt: "You are a flight lookup assistant. Follow the strategy chain below in order. On success, return the result immediately and stop. On failure, move to the next strategy.",
  finalMessage: "I can't help you with this flight information right now. Please visit www.google.com/travel/flights for more information.",
  strategies: [
    {
      name: "mainAPI",
      toolName: "fetchFlightById",
      description: "Main flight API - Search by flight ID (e.g., FL001)",
      instruction: "Call fetchFlightById with the user's flightId. If it returns an error or no data, proceed to the next strategy.",
      onFailure: "next",
      requiresUserInput: false,
      enabled: true,
    },
    // ... backupAPI, cacheTable, citySearch
  ],
};
```

### Instruction Generation (`src/utils/runFallbackStrategies.ts`)

Builds the full prompt on every turn, marking which strategies have already been tried:

```typescript
export function generateInstructions(flightId: string, currentStrategyIndex: number = 0): string {
  const { systemPrompt, finalMessage, strategies } = fallbackStrategies;
  const enabled = strategies.filter((s) => s.enabled);

  let instructions = `${systemPrompt}\n\nThe user is looking for flight **${flightId}**.\n\n`;
  instructions += "**Strategy chain:**\n\n";

  enabled.forEach((strategy, index) => {
    const status =
      index < currentStrategyIndex ? "TRIED" :
      index === currentStrategyIndex ? "CURRENT" : "PENDING";

    instructions += `${index + 1}. [${status}] **${strategy.name}** → tool: \`${strategy.toolName}\`\n`;
    instructions += `   ${strategy.description}\n`;
    instructions += `   Instruction: ${strategy.instruction}\n`;

    if (index < enabled.length - 1 && strategy.onFailure === "next") {
      instructions += `   On failure → go to strategy ${index + 2} (${enabled[index + 1]!.name})\n`;
    } else {
      instructions += `   On failure → tell the user: "${finalMessage}"\n`;
    }
    instructions += "\n";
  });

  return instructions;
}
```

### Conversation Handler (`src/conversations/webchat.ts`)

All strategy tools are passed to `execute()` together. The LLM navigates the chain from the prompt:

```typescript
const strategyTools = [fetchFlightById, fetchBackupFlight, searchCacheTable, serpFlightSearch];

const conversationState = z.object({
  flightId:             z.string().optional(),
  currentStrategyIndex: z.number().default(0),
  departureCity:        z.string().optional(),
  arrivalCity:          z.string().optional(),
  awaitingCities:       z.boolean().default(false),
});

async function flightHandler({ conversation, execute, message, state }: any) {
  // ... parse flightId and city pair from message ...

  const instructions = generateInstructions(currentFlightId, state.currentStrategyIndex);

  await execute({
    instructions: instructions + context,
    tools: strategyTools,
  });

  // Set awaitingCities if the current strategy requires user input
  const currentStrategy = fallbackStrategies.strategies[state.currentStrategyIndex];
  if (currentStrategy?.requiresUserInput && !state.departureCity && !state.awaitingCities) {
    state.awaitingCities = true;
  }
}
```

### Background Cache Refresh (`src/workflows/updateFlightPrices.ts`)

A scheduled workflow keeps the cache table populated so strategy 3 always has data:

```typescript
export default new Workflow({
  name: "updateFlightPrices",
  schedule: "*/1 * * * *", // Every 1 minute
  handler: async ({ step, logger }) => {
    await step("fetch-and-update", async () => {
      for (let i = 1; i <= 10; i++) {
        const flightId = `FL${String(i).padStart(3, "0")}`;
        const result = await fetchFlightById.handler({ input: { flightId } });

        if (!result.flight) continue;

        const existing = await flightCacheTable.findRows({ filter: { flightId }, limit: 1 });
        if (existing.rows.length > 0) {
          await flightCacheTable.updateRows({ rows: [{ id: existing.rows[0].id, price: result.flight.price, cachedAt: new Date().toISOString() }] });
        } else {
          await flightCacheTable.createRows({ rows: [{ flightId, ...result.flight, cachedAt: new Date().toISOString(), source: "price-updater" }] });
        }
      }
    });
  },
});
```

## Example Usage

Try these prompts to see the fallback chain in action:

- `FL001` — found immediately in the main API, chain stops at strategy 1
- `FL999` — not found in main or backup API, not in cache, falls through to strategy 4 and asks for airport codes
- `CDG to AUS` — after strategy 4 is reached, providing IATA codes triggers a SERP web search
- Any flight ID while the main API is down — automatically falls back through backup API and cache without any code changes

## Getting Started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start the development server:

   ```bash
   adk dev
   ```

3. Deploy your agent:

   ```bash
   adk deploy
   ```
