# CSV Import Pipeline

An ADK example demonstrating **Workflow <-> Conversation Communication** through a CSV import pipeline.

## Use Case

Import CSV data into Botpress Tables with validation. A background workflow processes the file, and when it hits issues (duplicates, bad format, missing fields), it pauses and asks the user how to handle them before continuing.

## How It Works

1. User uploads a CSV file via webchat
2. A background workflow parses, validates, and imports rows into ADK Tables
3. When the workflow encounters issues (duplicates, bad format, missing fields), it pauses via `step.request()` and asks the user how to resolve
4. The conversation handler surfaces the question, the user responds, and the conversation calls `workflow.provide()` to resume
5. The frontend polls the chat API every 1s for progress updates and renders a custom import card with an activity timeline

## Key Components

### Workflow ↔ Conversation Communication

The core pattern: workflows pause with `step.request()` to ask the user a question, and the conversation resumes them with `workflow.provide()`. This enables human-in-the-loop workflows where the AI agent mediates between a background process and the user.

### CSV Import Workflow (`bot/src/workflows/index.ts`)

A durable workflow that parses, validates, and imports CSV rows. Uses `workflow.setTimeout()` for large datasets and `workflow.fail()` when critical validation errors are unrecoverable.

### Conversation Handler (`bot/src/conversations/index.ts`)

Manages the import lifecycle — starts the workflow on file upload, surfaces `step.request()` questions to the user, calls `workflow.provide()` with answers, and supports `instance.cancel()` for aborting imports.

## Getting Started

1. Install dependencies:
   ```bash
   cd bot && bun install
   cd frontend && bun install
   ```

2. Start development server:
   ```bash
   cd bot && adk dev
   cd frontend && bun run dev
   ```

3. Deploy:
   ```bash
   cd bot && adk deploy
   ```
