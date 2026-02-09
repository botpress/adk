# Webchat RAG

A knowledge-grounded chatbot that answers questions about Botpress documentation using Retrieval-Augmented Generation (RAG), with guardrails to prevent hallucination and admin controls for managing the knowledge base.

## Use Case

When building AI agents that need to answer questions accurately from a specific body of knowledge — such as:

- Product documentation or help centers
- Internal company knowledge bases
- Support agents grounded in real content

This example shows how to wire up a website-sourced knowledge base, force the AI to search it before answering, and give admins the ability to refresh the index on demand.

## Key Components

### Knowledge Base (`src/knowledge/website-docs.ts`)

Uses `DataSource.Website.fromSitemap()` to crawl Botpress documentation. Filters out non-content URLs. This is the single source of truth for the agent's answers.

### Guardrails (`src/conversations/extensions/guardrails.ts`)

An `onBeforeTool` hook that prevents the AI from responding to questions without first searching the knowledge base. Uses `adk.zai.learn()` to classify whether a message requires a knowledge search.

### Admin Mode (`src/conversations/extensions/admin-mode.ts`)

Time-limited admin access via one-time codes. Uses `Autonomous.Object` to conditionally expose different tools based on authentication state — unauthenticated users get `generateLoginCode`, pending users get `loginWithCode`, and admins get `refreshKnowledgeBases`.

### Scheduled Indexing (`src/workflows/website-indexing.ts`)

A cron-scheduled workflow that refreshes the knowledge base every 6 hours, keeping content up to date without manual intervention.

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
