# Multimodel

A chatbot that can hot-swap between different LLM models mid-conversation and interpret uploaded images using vision-capable models.

## Use Case

When building AI agents that need flexibility across different models, such as:

- Comparing model outputs for the same prompt
- Switching to vision-capable models when images are uploaded
- Using faster/cheaper models for simple queries and more powerful ones for complex tasks

This example shows how to let users (or the agent itself) dynamically switch between any available LLM model at runtime, and how to handle image uploads with automatic vision model detection.

## How It Works

The conversation handler maintains the current model in conversation state. Three tools let the agent manage models: `getAllModels` lists every available model, `getCurrentModel` returns the active one, and `setCurrentModel` swaps to a new one. When an image is uploaded, the handler checks if the current model supports vision. If not, it automatically switches to a vision-capable model before interpreting the image.

## Key Components

### Conversation Handler (`src/conversations/index.ts`)

The main handler that:
- Tracks the current model in conversation state (`state.currentModel`)
- Provides tools for listing, getting, and setting models
- Detects image uploads and auto-switches to vision-capable models when needed
- Maintains an image history in state for multi-turn image conversations

### Model Helpers (`src/utils/model-helpers.ts`)

Utility functions for checking vision capability and formatting model display names.

### File Upload Processing (`src/utils/file-upload.ts`)

Handles image file uploads from the webchat widget, processing them for the vision model to interpret.

### Demo Page (`demo/index.html`)

A simple HTML page with the webchat widget embedded for testing.

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
