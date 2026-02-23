# Fallback Bot Example

Demonstrates **graceful tool degradation** in a Botpress ADK agent. When a primary data source fails, the bot automatically tries backup sources — without the LLM needing to manage the retry logic.

## Goal

AI agents depend on external APIs. APIs fail. This example shows the right way to handle that:

- **Deterministic fallback** (same input, same output) belongs in code, not in the LLM prompt
- **Non-deterministic fallback** (different input needed, user interaction required) is where the LLM adds value

The bot has one tool (`getFlightData`) that internally chains 3 data sources. If all fail, the LLM asks the user for different input and uses a second tool (`serpFlightSearch`). The conversation handler is 17 lines.

## How It Works

```
User: "Look up FL001"
  │
  ▼
LLM calls getFlightData({ flightId: "FL001" })
  │
  ├─ Try main API     → success? return data
  ├─ Try backup API   → success? return data
  ├─ Try cache table  → success? return data
  └─ All failed       → return { success: false, attemptedSources: [...] }
  │
  ▼
LLM: "I couldn't find that flight. What are the departure and arrival airports?"
  │
  ▼
User: "CDG to AUS"
  │
  ▼
LLM calls serpFlightSearch({ departure_airport: "CDG", arrival_airport: "AUS" })
  │
  ▼
Returns real flight results from Google Flights
```

The first 3 sources take a flight ID and return the same shape. No reasoning needed — code handles the fallback. The switch to route search requires different input from the user. That's where the LLM helps.

## Key Pattern: FallbackTool

`FallbackTool` (`bot/src/utils/FallbackTool.ts`) is a builder that composes multiple handlers into a single `Autonomous.Tool`. Each handler is tried in order. The first to return `{ success: true }` wins.

```typescript
// bot/src/tools/getFlightData.ts
export default new FallbackTool({
  name: "getFlightData",
  description: "Look up flight data by flight ID (e.g., FL001). Automatically tries multiple sources.",
  input: z.object({ flightId: z.string() }),
  output: flightOutputSchema,
})
  .addFallback("main", ({ flightId }) => fetchFlight(flightId, "main"))
  .addFallback("backup", ({ flightId }) => fetchFlight(flightId, "backup"))
  .addFallback("cache", ({ flightId }) => searchCache(flightId))
  .build();
```

The conversation handler stays minimal:

```typescript
// bot/src/conversations/webchat.ts
export const Webchat = new Conversation({
  channel: "webchat.channel",
  handler: async ({ execute }) => {
    await execute({
      instructions: `You are a flight pricing agent. Help users find flight information.

Use getFlightData to look up flights by ID (e.g., FL001).
If it reports all sources failed, ask the user for departure and arrival airport IATA codes, then use serpFlightSearch.
If serpFlightSearch also fails, tell the user to visit www.google.com/travel/flights.`,
      tools: [getFlightData, serpFlightSearch],
    });
  },
});
```

## Project Structure

```
fallback/
├── bot/                              # Botpress ADK agent
│   ├── agent.config.ts               # Agent config — model, integrations, API_BASE_URL
│   └── src/
│       ├── conversations/
│       │   └── webchat.ts            # Conversation handler — 2 tools, simple prompt
│       ├── tools/
│       │   ├── getFlightData.ts      # FallbackTool: main API → backup API → cache
│       │   └── serpFlightSearch.ts   # Google Flights search via SerpAPI (needs airport codes)
│       ├── actions/                  # Business logic reused by tools and workflows
│       │   ├── fetchFlight.ts        # HTTP call to main or backup API endpoint
│       │   ├── searchCache.ts        # Query the flight cache table
│       │   ├── serpFlightSearch.ts   # Call SerpAPI and transform response
│       │   └── types.ts             # Shared Flight type
│       ├── utils/
│       │   └── FallbackTool.ts      # Generic FallbackTool builder class
│       ├── tables/
│       │   └── flightCacheTable.ts  # Cached flight data (populated by workflow)
│       └── workflows/
│           └── updateFlightPrices.ts # Cron job — refreshes cache for FL001-FL010 every minute
│
├── example-server-api/               # Express.js flight API
│   └── src/index.ts                  # 100 random flights, admin toggles, SerpAPI proxy
│
└── frontend/                         # React + Vite + Tailwind webchat UI
    └── src/
        ├── App.tsx                   # Layout — chat area + sidebar
        ├── components/               # Chat UI, endpoint toggles, test buttons
        └── hooks/                    # useAdminStatus — polls endpoint status
```

### What each part does

**Bot** — The ADK agent. Receives messages via webchat, uses `execute()` with 2 tools. The `getFlightData` tool handles fallback internally. The `serpFlightSearch` tool is called by the LLM only when the user provides airport codes.

**API Server** — An Express server with 100 pre-generated flights (FL001–FL100). Has 3 flight endpoints (main, backup, original) that can be independently enabled/disabled via admin routes. Prices fluctuate dynamically. Also proxies SerpAPI for real Google Flights data.

**Frontend** — A React app with a Botpress webchat widget and a sidebar control panel. The sidebar shows endpoint status badges and lets you toggle each endpoint on/off to simulate failures in real time.

## Running It

### 1. API Server

```bash
cd example-server-api
npm install
cp .env.example .env    # Add SERPAPI_KEY for real flight search (optional)
npm run dev              # http://localhost:3002
```

### 2. Bot

```bash
cd bot
bun install
# Create .env with API_BASE_URL=http://localhost:3002
adk dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

## Testing Fallback Behavior

Use the frontend sidebar toggles or curl to simulate failures:

| Scenario | Toggle | Expected behavior |
|----------|--------|-------------------|
| Happy path | All enabled | `getFlightData` returns from main API |
| Main down | Disable main | Falls back to backup API |
| Main + backup down | Disable both | Falls back to cache (FL001–FL010 are cached) |
| All down | Disable all | Bot asks for airport codes, uses `serpFlightSearch` |
| Recovery | Re-enable | Next request uses main API again |

```bash
# Toggle endpoints via admin API
curl -X POST http://localhost:3002/api/admin/endpoint/main/disable
curl -X POST http://localhost:3002/api/admin/endpoint/backup/disable
curl http://localhost:3002/api/admin/status
curl -X POST http://localhost:3002/api/admin/endpoint/main/enable
```

## Design Decisions

**Why not let the LLM manage the fallback chain?**
The main API, backup API, and cache all take a flight ID and return the same data shape. There's no reasoning involved — you always try them in the same order. Putting this in the prompt wastes tokens, adds latency (each LLM iteration is seconds vs milliseconds for an HTTP call), and introduces unreliability (the LLM might skip a step or retry the wrong source).

**Why is serpFlightSearch a separate tool?**
It requires different input (airport codes instead of flight ID) and the user needs to provide it. This is an actual decision point where the LLM adds value — it asks the user, extracts the codes, and calls the tool.

**Why use FallbackTool instead of a plain function?**
A plain function works fine for one tool. `FallbackTool` is a reusable builder that could be extracted into a shared utility. It also labels each source (`source: "backup"` in the response), which is useful for debugging and logging.
