# Webchat Kitchen Sink - Communication Patterns Demo

An interactive demo showcasing the 4 communication patterns between a React frontend and a Botpress ADK bot.

## Patterns Demonstrated

### 1. Fire-and-Forget (Frontend → Bot)
One-way events that don't expect a response. Perfect for analytics, UI interactions, or notifications.

**Example:** Click "Track Page View" button - the event is sent to the bot and logged without waiting for a response.

### 2. Request/Response (Frontend ↔ Bot)
Promise-based pattern with correlated request/response. Use for data fetching, CRUD operations, or any action needing confirmation.

**Example:** The Counter and Notes features use this pattern - increment the counter, and the frontend awaits the new value from the bot.

### 3. Custom Message Blocks (Bot → Frontend)
Bot sends rich UI components to the chat. These are custom React components rendered inline.

**Example:** Ask the bot to "send me an info card" or "show the event log" - styled components appear in the chat.

### 4. Bot Requests (Bot → Frontend → Bot)
Bot-initiated requests with confirmation UI. The bot can request data/actions from the browser.

**Example:** Ask "What's my browser URL?" - the bot sends a request, you see a confirmation dialog, and the result is sent back.

## Project Structure

```
webchat-kitchen-sink/
├── bot/                          # Botpress ADK bot
│   ├── agent.config.ts           # Bot configuration
│   └── src/
│       ├── conversations/        # Message handlers
│       │   └── index.ts          # Main conversation with all 4 patterns
│       └── utils/
│           ├── shared-types.ts   # Type definitions (source of truth)
│           ├── event-guards.ts   # Event extraction utilities
│           ├── response-senders.ts   # Pattern 2 response senders
│           └── custom-messages.ts    # Pattern 3 & 4 message creators
│
└── frontend/                     # React frontend
    └── src/
        ├── App.tsx               # Main app with webchat integration
        ├── types/
        │   └── shared.ts         # Types (mirrored from bot)
        ├── hooks/
        │   ├── useFireAndForget.ts   # Pattern 1
        │   ├── useBotRequest.ts      # Pattern 2
        │   └── useBotRequests.ts     # Pattern 4
        └── components/
            ├── DemoPanel.tsx         # Interactive demo controls
            ├── CustomBlockRenderer.tsx   # Routes custom messages
            ├── InfoCard.tsx          # Pattern 3 component
            ├── EventLog.tsx          # Pattern 1 visualization
            └── BotRequestCard.tsx    # Pattern 4 confirmation UI
```

## Getting Started

### Prerequisites

- Node.js 18+
- Botpress ADK CLI (`npm install -g @botpress/adk`)

### Setup

1. **Start the bot:**
   ```bash
   cd bot
   npm install
   adk dev
   ```

2. **Deploy the bot** (to get a Client ID):
   ```bash
   adk deploy
   ```

3. **Configure the frontend:**
   ```bash
   cd frontend
   npm install
   # Create .env file with your Client ID
   echo "VITE_CLIENT_ID=your-client-id" > .env
   ```

4. **Start the frontend:**
   ```bash
   npm run dev
   ```

## How It Works

### Frontend → Bot Communication

**Fire-and-Forget (Pattern 1):**
```typescript
const { sendEvent } = useFireAndForget();
sendEvent("analytics:track", { event: "button_clicked" });
```

**Request/Response (Pattern 2):**
```typescript
const { request } = useBotRequest();
const response = await request("counter:increment:request", { amount: 1 });
console.log(response.newValue); // Typed response!
```

### Bot → Frontend Communication

**Custom Blocks (Pattern 3):**
```typescript
// In bot conversation handler
await sendInfoCard({
  title: "Welcome!",
  description: "This is a custom card",
  variant: "info"
});
```

**Bot Requests (Pattern 4):**
```typescript
// Bot requests browser URL
const { requestId, messageId } = await requestBrowserUrl();
// Frontend shows confirmation, user approves, response flows back
```

## Key Concepts

- **Type Safety**: Types are defined in `shared-types.ts` and shared between bot and frontend
- **Request IDs**: Pattern 2 & 4 use correlation IDs to match requests with responses
- **Custom Messages**: Use `custom://` URLs to route to specific React components
- **Permissions**: Pattern 4 supports "always allow" / "always deny" preferences

## Learn More

- [Botpress ADK Documentation](https://botpress.com/docs/for-developers/adk/overview)
- [Frontend-Bot Communication Pattern Guide](../FRONTEND_BOT_COMMUNICATION_PATTERN.md)
