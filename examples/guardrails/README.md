# Guardrails

A pattern for implementing topic guardrails that keep your AI agent focused on specific subjects using the Botpress ADK.

## Demo

Try it live: **[https://guardrails.botpress.bot](https://guardrails.botpress.bot)**

![Demo](./demo.gif)

## Use Case

When building AI agents, you often need to ensure the conversation stays on topic. This example demonstrates how to implement **topic guardrails** that:

- Monitor conversation content in real-time
- Detect when users drift off-topic
- Gracefully redirect users back to the intended subject
- Display visual feedback when guardrails are triggered

## How It Works

When a message arrives, the handler fetches the full conversation transcript and immediately starts a `zai.check()` — an LLM yes/no classification that evaluates whether the conversation is on-topic. This check runs concurrently with `execute()` setup.

The `onBeforeExecution` hook fires before each iteration of the agent loop and awaits the check result. If the topic is valid, the agent proceeds normally. If not, the hook sends a custom guardrail message to the frontend (rendered as a warning card) and throws an error. The error message becomes instructions the AI reads on the next iteration — telling it to "recover seamlessly" by redirecting the user back to Botpress topics.

The key design choice is using `onBeforeExecution` instead of `onBeforeTool` (which the webchat-rag example uses). `onBeforeTool` only fires when the AI calls a tool — if the AI tries to respond directly without tools, the guardrail would never trigger. `onBeforeExecution` fires before every agent iteration, so nothing gets through.

## Key Components

### Topic Check with `zai.check()`

Uses the Zai library to verify if the conversation stays on topic:

```typescript
const guardAsync = adk.zai.check(
  transcript,
  `Is the transcript topic specifically about "Botpress"?`,
  {
    examples: [
      { input: "Tell me about Botpress features.", check: true },
      { input: "Tell me about cooking recipes.", check: false },
    ],
  }
);
```

### `onBeforeExecution` Hook

The guardrail runs before each agent execution cycle:

```typescript
await execute({
  instructions: "You are a helpful assistant that only talks about Botpress.",
  hooks: {
    onBeforeExecution: async () => {
      const guard = await guardAsync;
      if (!guard) {
        throw new Error("Conversation stopped by guardrail...");
      }
    },
  },
});
```

### Custom Guardrail Messages

When triggered, a custom message is sent to display in the UI:

```typescript
await conversation.send({
  type: "custom",
  payload: {
    url: "custom://guardrail",
    name: "TopicError",
    data: {
      name: "Out of Topic",
      message: "Topic is not about Botpress",
    },
  },
});
```

## Example Usage

Try these prompts to see the guardrail in action:

- ✅ "What is Botpress?" - On topic, agent responds normally
- ✅ "How do I build a chatbot?" - Related to Botpress, agent responds
- ❌ "Tell me a recipe for pizza" - Off topic, guardrail triggers
- ❌ "What's the weather like?" - Off topic, guardrail triggers

## Getting Started

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start development server:
   ```bash
   adk dev
   ```

3. Deploy:
   ```bash
   adk deploy
   ```
