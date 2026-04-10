# Webchat User Data

Demonstrates how to pass user data from a website to a Botpress bot through the webchat widget using `updateUser` and `getUserData`.

## Use Case

When your bot is embedded on a website where users are already authenticated (e.g., a customer portal), you often need to pass session data — like a JWT, email, or user ID — from the website to the bot so it can perform authenticated actions without asking the user to re-identify themselves.

This example shows:

- How to pass arbitrary data from the website to the bot via `window.botpress.updateUser()`
- How to read that data inside the bot using `actions.webchat.getUserData()`
- The critical timing requirement: `updateUser` **must** be called on the `webchat:ready` event (not `webchat:initialized`)

## How It Works

### Website Side

The website loads the webchat widget and calls `updateUser({ data: { ... } })` on the `webchat:ready` event:

```html
<div id="webchat"></div>

<script src="https://cdn.botpress.cloud/webchat/v3.6/inject.js"></script>
<script>
  window.botpress.init({
    botId: "YOUR_BOT_ID",
    clientId: "YOUR_CLIENT_ID",
    selector: "#webchat",   // Embeds the webchat inside the div
  });

  window.botpress.on("webchat:ready", function () {
    window.botpress.updateUser({
      data: {
        jwt: "eyJhbGciOiJIUzI1...",      // Session JWT from your auth system
        email: "user@example.com",
        plan: "premium",
      },
    });
  });
</script>
```

### Bot Side

In the conversation handler, the bot reads the user data using `actions.webchat.getUserData()`:

```typescript
const ud = await actions.webchat.getUserData({ userId: event?.userId as string });
const jwt = (ud as any)?.userData?.jwt;
const email = (ud as any)?.userData?.email;
```

## Critical Details

### Timing: `webchat:ready`, NOT `webchat:initialized`

The `updateUser` call **must** happen on the `webchat:ready` event. If called on `webchat:initialized`, the data will **not** be persisted to the server and `getUserData` will return `{}`.

- `webchat:initialized` — The widget is loaded but the connection is not yet established
- `webchat:ready` — The connection is fully established and data can be persisted

### Embedded Mode Recommended

For the most reliable data flow, embed the webchat inside a page element using the `selector` property in `botpress.init()`. The webchat element ID can be configured in your bot's Dashboard under **Webchat > Deploy Settings > Chat Interface > Embedded**.

### `getUserData` Returns `{ userData: { ... } }`

The data is nested under `userData` in the response. All values are strings:

```typescript
const result = await actions.webchat.getUserData({ userId });
// result = { userData: { jwt: "eyJ...", email: "user@example.com", plan: "premium" } }
```

### Error Handling for Multi-Channel Bots

If your bot also handles the `chat` channel, `getUserData` will throw on non-webchat conversations. Always wrap it in a try/catch:

```typescript
try {
  const ud = await actions.webchat.getUserData({ userId: event?.userId as string });
  // use ud.userData...
} catch {
  // Not a webchat channel — skip
}
```

## Key Components

### Configuration (`agent.config.ts`)

Declares the webchat integration and user state for persisting the extracted data across tool calls.

### Conversation Handler (`src/conversations/webchat.ts`)

Reads user data via `getUserData` on every message and stores it in `user.state` for tools to access.

### Sample Page (`website/index.html`)

A minimal HTML page demonstrating the website-side integration pattern.

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Update `website/index.html` with your bot's `botId` and `clientId` (from your Dashboard)

3. Start development server:
   ```bash
   adk dev
   ```

4. Serve the sample page:
   ```bash
   npx serve website
   ```

5. Open the page, paste a test value, and chat with the bot

6. Deploy:
   ```bash
   adk deploy
   ```
