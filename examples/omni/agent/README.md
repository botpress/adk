# Omni

Multi-agent system with local execution capabilities built on the Botpress ADK.

## Overview

Omni is a multi-agent AI system that combines cloud-hosted Botpress agent platform with local execution power. It uses a two-tier architecture:

- **Omni (this package)**: The ADK-based agent that runs on Botpress infrastructure, providing conversation handling, AI reasoning, and task orchestration
- **[omni-local-plane](../omni-local-plane/)**: A local HTTP server that executes commands on your machine (bash, file operations, browser automation, etc.)

This separation allows the AI to reason about tasks while securely executing operations on your local system through an authenticated bridge.

## Features

- **7 Specialized Agents**: Main orchestrator plus specialists for coding, research, browser automation, data extraction, home automation, and app automation
- **80+ Tools**: File operations, bash execution, git, browser automation, process management, app introspection, instrumentation, Frida dynamic instrumentation, and more
- **Policy-Based Access**: Fine-grained control over which tools each agent can use
- **Skills Table**: Skills stored in a database table with semantic search for prompt injection
- **App Automations Table**: Executable automation scripts discovered through app introspection
- **17 Bundled Skills**: GitHub, tmux, email, 1Password, Apple Notes/Reminders, Spotify, and more
- **App Introspection**: CDP-based introspection for Electron/Chromium apps, Frida-based instrumentation for native apps
- **Frida Integration**: Dynamic instrumentation for native applications - attach to processes, enumerate modules/exports, hook functions, read/write memory
- **Context Loading**: SOUL.md for personality, memory files for state

## Getting Started

### Prerequisites

- [pnpm](https://pnpm.io) installed
- [ADK CLI](../cli/) installed (`pnpm install -g @botpress/adk`)
- [omni-local-plane](../omni-local-plane/) running locally

### Configuration

Configure the agent in `agent.config.ts`:

```typescript
configuration: {
  schema: z.object({
    localPlaneUrl: z.string().optional(),      // URL of local plane through ngrok/cloudflare tunnels
    localPlaneToken: z.string().secret().optional(), // Token for security
    workspacePath: z.string().optional(),      // Default workspace path on local machine (default ~/omni)
    soulMdPath: z.string().optional(),         // Path to SOUL.md personality file on local machine
  }),
}
```

### Running

```bash
# Start the local plane first (in another terminal)
cd ../omni-local-plane
bun run dev

# Start omni in development mode
cd ../omni
adk dev
```

## Architecture

### Agent System

Omni uses a hierarchical agent system where a main orchestrator delegates to specialized agents:

```
┌─────────────────────────────────────────────────────────┐
│                    Main Orchestrator                     │
│         (coordinates tasks, handles general queries)     │
└─────────────────────────────────────────────────────────┘
                              │
       ┌──────────┬───────────┼───────────┬──────────┐
       │          │           │           │          │
       ▼          ▼           ▼           ▼          ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│  Coder    │ │ Research  │ │   Home    │ │  Browser  │ │    App    │
│ Specialist│ │ Specialist│ │ Automation│ │ Automation│ │ Engineer  │
└───────────┘ └───────────┘ └───────────┘ └─────┬─────┘ └───────────┘
                                                │
                                                ▼
                                          ┌───────────┐
                                          │ Extractor │
                                          │  (leaf)   │
                                          └───────────┘
```

**Agent Registry** (`src/agents/registry.ts`): Manages agent definitions and resolves instructions dynamically based on context.

### Tool System

Tools are executed via the local plane bridge. Each tool has:

- A schema defining inputs/outputs
- A factory function that creates the tool instance
- Group membership for policy-based access

**Tool Registry** (`src/tools/registry.ts`): Manages tool definitions and creates tool instances for agents based on their policies.

**Tool Groups**:

- `group:local` - bash, file operations, git
- `group:memory` - context loading, memory read/write
- `group:filesystem` - file read/write/edit/grep/glob/ls
- `group:process` - PTY process spawn/send/read/kill
- `group:browser` - Playwright browser automation (16 tools)
- `group:skills` - skill management tools
- `group:apple` - osascript for macOS automation
- `group:introspect` - app discovery, CDP connection, module traversal, store discovery, React inspection (10 tools)
- `group:instrument` - function hooking, code injection, IPC interception (7 tools)
- `group:frida` - Frida dynamic instrumentation for native apps (18 tools)
- `group:skill-gen` - skill drafting, upserting, querying (4 tools)
- `group:app-automation` - automation scripts: upsert, query, get, run (4 tools)

### Skill System

Skills are stored in a database table (`SkillsTable`) with semantic search capabilities. The system supports three skill sources:

- **Seed Skills**: Bundled markdown files automatically migrated to the table on first run
- **Discovered Skills**: Created by the app-engineer agent through introspection
- **User Skills**: Manually created by users

**Skills Table** (`src/tables/skills.ts`): Defines the schema for skill storage with columns for identity, discovery metadata, content, requirements, injection code, and metadata.

**Seed Data** (`src/skills/seed-data.ts`): Converts filesystem SKILL.md files to table rows and handles initial seeding.

**Skill Loader** (`src/skills/loader.ts`): Parses SKILL.md files from the `skills/` directory for seed data.

**Table Loader** (`src/skills/table-loader.ts`): Loads skills from the SkillsTable with filesystem fallback.

**Skill Installer** (`src/skills/installer.ts`): Handles dependency installation (brew, apt, go, npm, pip, cargo, etc.).

### Bridge Client

The bridge client (`src/bridge/client.ts`) handles authenticated HTTP communication with the local plane:

```typescript
// All tool handlers use this pattern
const result = await callLocalPlane("/browser/launch", input, ctx.config);
```

## Agents

| Agent            | ID             | Description                                                              |
| ---------------- | -------------- | ------------------------------------------------------------------------ |
| **Main**         | `main`         | Primary orchestrator that coordinates tasks and delegates to specialists |
| **Coder**        | `coder`        | Expert at writing, reviewing, and debugging code across languages        |
| **Research**     | `research`     | Gathers information, analyzes codebases, and synthesizes findings        |
| **Browser**      | `browser`      | Automates browser interactions using Playwright                          |
| **Extractor**    | `extractor`    | Extracts and structures data from web pages                              |
| **Home**         | `home`         | Controls smart home devices and manages home automation                  |
| **App Engineer** | `app-engineer` | Introspects desktop apps and creates executable automation scripts       |

## Tools

### File Operations

- `file_read` - Read file contents
- `file_write` - Write file contents
- `file_edit` - Edit files with search/replace
- `file_grep` - Search file contents with regex
- `file_glob` - Find files by pattern
- `file_ls` - List directory contents

### Execution

- `bash` - Execute shell commands
- `git` - Git operations
- `osascript` - macOS AppleScript/JXA execution

### Process Management

- `process_spawn` - Spawn interactive PTY processes
- `process_send_keys` - Send keystrokes to processes
- `process_read` - Read process output
- `process_kill` - Terminate processes
- `process_list` - List running processes
- `process_resize` - Resize PTY dimensions

### Browser Automation

- `browser_launch` - Launch browser session
- `browser_navigate` - Navigate to URL
- `browser_snapshot` - Get accessibility tree with element refs
- `browser_click` - Click elements
- `browser_type` - Type into inputs
- `browser_hover` - Hover over elements
- `browser_scroll` - Scroll page/elements
- `browser_press_key` - Press keyboard keys
- `browser_select_option` - Select dropdown options
- `browser_screenshot` - Capture screenshots
- `browser_extract` - Extract data from elements
- `browser_execute` - Execute JavaScript
- `browser_wait` - Wait for conditions
- `browser_close` - Close session
- `browser_console` - Get console messages
- `browser_errors` - Get JavaScript errors

### Memory & Context

- `context_load` - Load SOUL.md, AGENTS.md, and context files
- `memory_read` - Read from memory store
- `memory_write` - Write to memory store

### Skills

- `skill_list` - List available skills
- `skill_info` - Get skill details
- `skill_install` - Install skill dependencies
- `skill_setup` - Run skill setup
- `skill_prompt` - Get skill prompt for current context

### App Introspection

- `app_discover` - Find running apps, detect Electron/Chromium, find debug ports
- `cdp_connect` - Connect to Chrome DevTools Protocol endpoint
- `cdp_evaluate` - Execute JavaScript in app context
- `cdp_dom` - Query DOM and extract selectors
- `cdp_targets` - List available CDP targets
- `cdp_close` - Close CDP session
- `module_traverse` - Walk webpack modules, find exports
- `store_discover` - Find Redux/MobX/Zustand stores
- `react_inspect` - Traverse React fiber tree
- `ipc_enumerate` - List registered IPC channels

### Instrumentation (CDP)

- `function_hook` - Wrap function with pre/post hooks
- `function_replace` - Replace function implementation
- `ipc_intercept` - Intercept IPC messages
- `state_subscribe` - Watch store state changes
- `inject_script` - Inject JavaScript into app context
- `hook_remove` - Remove installed hook
- `hook_list` - List active hooks

### Frida (Native Apps)

- `frida_process_list` - List running processes available for attachment
- `frida_attach` - Attach to a running process by PID or name
- `frida_spawn` - Spawn a new process with Frida attached
- `frida_detach` - Detach from a process and clean up
- `frida_sessions` - List active Frida sessions
- `frida_modules` - Enumerate loaded modules in a process
- `frida_exports` - List exports from a specific module
- `frida_classes` - Enumerate ObjC/Java classes (macOS)
- `frida_intercept` - Hook function with onEnter/onLeave callbacks
- `frida_replace` - Replace function implementation entirely
- `frida_call` - Call a native function directly
- `frida_remove_hook` - Remove an installed hook
- `frida_list_hooks` - List active hooks in a session
- `frida_script` - Load and run a Frida script
- `frida_unload_script` - Unload a running script
- `frida_evaluate` - Evaluate JavaScript in Frida context
- `frida_memory_read` - Read bytes from process memory
- `frida_memory_write` - Write bytes to process memory

### Skill Generation

- `skill_draft` - Generate skill from discovered capabilities
- `skill_upsert` - Insert or update skill in SkillsTable
- `skill_query` - Search skills by semantic query
- `skill_get` - Get skill by name

### App Automation

- `automation_upsert` - Insert or update automation script in AppAutomationsTable
- `automation_query` - Search automations by semantic query
- `automation_get` - Get automation by name
- `automation_run` - Execute an automation script

### Delegation

- `delegate` - Delegate tasks to specialist agents

## Skills

Bundled skills in the `skills/` directory:

| Skill              | Description                     |
| ------------------ | ------------------------------- |
| `1password`        | 1Password CLI integration       |
| `apple-notes`      | Apple Notes via AppleScript     |
| `apple-reminders`  | Apple Reminders via AppleScript |
| `bird`             | Bird CLI for iOS simulator      |
| `coding-agent`     | Code editing and development    |
| `github`           | GitHub CLI operations           |
| `google-workspace` | Google Workspace integration    |
| `himalaya`         | Email via himalaya CLI          |
| `imessage`         | iMessage via AppleScript        |
| `mcporter`         | MCP server management           |
| `nano-pdf`         | PDF processing                  |
| `openai-whisper`   | Audio transcription             |
| `spotify-player`   | Spotify playback control        |
| `summarize`        | Content summarization           |
| `tmux`             | tmux session management         |
| `video-frames`     | Video frame extraction          |
| `weather`          | Weather information             |

Skills are loaded from markdown files with frontmatter defining:

- Name and description
- Required binaries and tools
- Platform compatibility
- Install instructions
- Setup steps

### Skills Table Schema

Skills are stored in a database table for prompt injection:

| Column                | Type                             | Description                           |
| --------------------- | -------------------------------- | ------------------------------------- |
| `name`                | string                           | Unique skill identifier               |
| `displayName`         | string                           | Human-readable name                   |
| `description`         | string                           | What this skill does                  |
| `source`              | `seed` \| `discovered` \| `user` | How the skill was created             |
| `promptContent`       | string                           | Markdown content for prompt injection |
| `requiresBins`        | string?                          | JSON array of required binaries       |
| `requiresEnvVars`     | string?                          | JSON array of required env vars       |
| `requiresPlatform`    | string?                          | JSON array: darwin, linux, win32      |
| `installInstructions` | string?                          | JSON array of install instructions    |
| `version`             | number                           | Skill version number                  |
| `tags`                | string?                          | JSON array of tags                    |
| `userInvocable`       | boolean                          | Whether users can invoke via /command |
| `priority`            | number                           | Priority for ordering in prompt       |

### App Automations Table Schema

Executable automation scripts discovered through app introspection:

| Column            | Type                              | Description                          |
| ----------------- | --------------------------------- | ------------------------------------ |
| `name`            | string                            | Unique automation identifier         |
| `displayName`     | string                            | Human-readable name                  |
| `description`     | string                            | What this automation does            |
| `targetApp`       | string                            | Target app bundle ID or process name |
| `injectionType`   | `cdp` \| `frida` \| `applescript` | Type of runtime injection            |
| `injectionCode`   | string                            | Code to execute at runtime           |
| `inputSchema`     | string?                           | JSON Schema for automation inputs    |
| `outputSchema`    | string?                           | JSON Schema for automation outputs   |
| `targetSelectors` | string?                           | JSON: module paths, function names   |
| `discoveredFrom`  | string?                           | App/context where discovered         |
| `discoveredAt`    | string?                           | ISO timestamp of discovery           |
| `discoveryMethod` | string?                           | CDP, frida, accessibility, etc.      |
| `version`         | number                            | Automation version number            |
| `tags`            | string?                           | JSON array of tags                   |
| `enabled`         | boolean                           | Whether automation is active         |

## App Automation

The App Engineer agent uses an **automation-first approach** to introspect desktop applications and create executable automation scripts. Rather than generating static skills, it creates runnable automations stored in the AppAutomationsTable that can be executed on demand.

It supports two instrumentation methods based on app type:

- **CDP (Chrome DevTools Protocol)** - For Electron/Chromium apps
- **Frida** - For native applications (macOS, Linux)

### Workflow

1. **Discover** - Find running apps, detect app type (Electron vs native)
2. **Connect** - Establish CDP connection (Electron) or Frida session (native)
3. **Explore** - Enumerate modules, exports, classes, state stores
4. **Experiment** - Test calling discovered functions
5. **Instrument** - Set up hooks for reliable automation
6. **Save Automation** - Store executable script in AppAutomationsTable via `automation_upsert`
7. **Execute** - Run automations on demand via `automation_run`

### CDP Workflow (Electron/Chromium Apps)

| Step       | Tools                                                                   |
| ---------- | ----------------------------------------------------------------------- |
| Connect    | `cdp_connect` - Connect to debug port                                   |
| Explore    | `module_traverse`, `store_discover`, `react_inspect`, `ipc_enumerate`   |
| Experiment | `cdp_evaluate` - Execute JavaScript                                     |
| Instrument | `function_hook`, `function_replace`, `ipc_intercept`, `state_subscribe` |
| Save       | `automation_upsert` - Store automation with `injectionType: 'cdp'`      |

**CDP Introspection Methods:**

| Method              | Description                                         |
| ------------------- | --------------------------------------------------- |
| **Webpack Modules** | Access `__webpack_modules__`, `__webpack_require__` |
| **React Fiber**     | Traverse React component tree and state             |
| **Redux/Store**     | Find Redux/MobX/Zustand state stores                |
| **IPC Channels**    | Enumerate `ipcMain`/`ipcRenderer` handlers          |

### Frida Workflow (Native Apps)

| Step       | Tools                                                                |
| ---------- | -------------------------------------------------------------------- |
| Connect    | `frida_attach` or `frida_spawn`                                      |
| Explore    | `frida_modules`, `frida_exports`, `frida_classes`                    |
| Experiment | `frida_call` - Call functions directly                               |
| Instrument | `frida_intercept`, `frida_replace`                                   |
| Save       | `automation_upsert` - Store automation with `injectionType: 'frida'` |

**Frida Introspection Methods:**

| Method                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| **Module Enumeration** | List all loaded shared libraries/dylibs        |
| **Export Enumeration** | Find exported functions in modules             |
| **Class Enumeration**  | ObjC classes (macOS) or Java classes (Android) |
| **Memory Access**      | Read/write process memory directly             |
| **Function Hooking**   | Intercept with onEnter/onLeave callbacks       |

### Example: Discovering VS Code Commands (CDP)

```javascript
// Find command palette handler
const modules = __webpack_modules__;
const commandService = Object.keys(modules)
  .filter((k) => k.includes("commandService"))
  .map((k) => __webpack_require__(k));

// Hook into command execution
commandService.executeCommand(
  "workbench.action.files.openFile",
  "/path/to/file",
);
```

### Example: Hooking Native Functions (Frida)

```javascript
// Hook open() to log file access
Interceptor.attach(Module.findExportByName("libc.so.6", "open"), {
  onEnter: function (args) {
    console.log("open:", args[0].readUtf8String());
  },
  onLeave: function (retval) {
    console.log("fd:", retval.toInt32());
  },
});

// Call getpid() directly
const getpid = new NativeFunction(
  Module.findExportByName("libc.so.6", "getpid"),
  "int",
  [],
);
console.log("PID:", getpid());
```

## Development

```bash
# Install dependencies (pnpm required for frida compilation)
pnpm install

# Run in development mode, go to botpress bot dashboard and set ngrok tunnel URL and token
adk dev

# Build for production
adk build

# Deploy to Botpress
adk deploy
```
