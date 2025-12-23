# Guardrails

A pattern for implementing topic guardrails that keep your AI agent focused on specific subjects using the Botpress ADK.

## Use Case

When building AI agents, you often need to ensure the conversation stays on topic. This example demonstrates how to implement **topic guardrails** that:

- Monitor conversation content in real-time
- Detect when users drift off-topic
- Gracefully redirect users back to the intended subject
- Display visual feedback when guardrails are triggered

## How It Works

1. **Before each agent execution**, the conversation transcript is analyzed using `zai.check()`
2. The check runs **asynchronously** to avoid blocking the response
3. If the topic drifts off-topic, a **custom guardrail message** is sent to the UI
4. The agent receives an error with instructions to **recover gracefully**
5. The agent redirects the user back to the intended topic

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
