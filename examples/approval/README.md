# Tool Approval Flow

A pattern for requiring user approval before executing sensitive or irreversible tool actions in your Botpress agent.

## Use Case

When building AI agents, certain actions may be sensitive, costly, or irreversible—such as:

- Sending emails or messages
- Making purchases or financial transactions
- Deleting or modifying data
- Calling external APIs with side effects

This example demonstrates how to implement a **human-in-the-loop** approval pattern, where the agent must obtain explicit user confirmation before executing specific tools.

## How It Works

1. **Wrap your tools** with the `ToolWithApproval` class instead of using `Autonomous.Tool` directly
2. When the agent attempts to call an approval-required tool, it **throws an error** indicating approval is needed
3. The agent asks the user for confirmation (e.g., with Approve/Reject buttons)
4. Once the user responds, the agent **retries the tool call** with the same input
5. The tool detects the user has responded since the last attempt and **executes normally**

## Key Components

### `ToolWithApproval` Class

A wrapper around `Autonomous.Tool` that:

- Tracks pending approvals in conversation state
- Blocks execution until user confirms
- Automatically clears approvals after execution
- Limits stored pending approvals to prevent state bloat

### Conversation State Extension

Extend your conversation state with `ToolWithApproval.ApprovalState` to enable approval tracking:

```typescript
state: z.object({}).extend(ToolWithApproval.ApprovalState);
```

## Example Usage

```typescript
const SendEmailTool = new ToolWithApproval({
  state,
  name: "send_email",
  description: "Sends an email to a recipient",
  input: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  output: z.object({ sent: z.boolean() }),
  handler: async (input) => {
    // Actually send the email
    return { sent: true };
  },
});
```

When the agent calls this tool, it will first ask the user to approve the email before sending.
