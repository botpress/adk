---
name: coding-agent
description: Run Codex CLI, Claude Code, OpenCode, or Pi Coding Agent for programmatic code generation and modification.
metadata:
  {
    "omni": { "emoji": "🧩", "requires": { "anyBins": ["claude", "codex", "opencode", "pi"] } },
  }
---

# Coding Agent

Use coding agents (Codex, Claude Code, OpenCode, Pi) for code generation and modification tasks.

## Quick Start: One-Shot Tasks

For quick prompts, create a temp git repo (Codex requires git) and run:

```bash
# Quick task (Codex needs a git repo!)
SCRATCH=$(mktemp -d) && cd $SCRATCH && git init && codex exec "Your prompt here"

# Or in a real project
cd ~/Projects/myproject && codex exec "Add error handling to the API calls"
```

**Why git init?** Codex refuses to run outside a trusted git directory. Creating a temp repo solves this for scratch work.

## Available Agents

### Codex CLI

**Model:** `gpt-5.2-codex` is the default

| Flag            | Effect                                             |
| --------------- | -------------------------------------------------- |
| `exec "prompt"` | One-shot execution, exits when done                |
| `--full-auto`   | Sandboxed but auto-approves in workspace           |
| `--yolo`        | NO sandbox, NO approvals (fastest, most dangerous) |

```bash
# One-shot with auto-approval
codex exec --full-auto "Build a dark mode toggle"

# Yolo mode for quick fixes
codex --yolo "Refactor the auth module"
```

### Claude Code

```bash
claude "Your task"
```

### OpenCode

```bash
opencode run "Your task"
```

### Pi Coding Agent

```bash
# Install: npm install -g @mariozechner/pi-coding-agent
pi "Your task"

# Non-interactive mode
pi -p "Summarize src/"

# Different provider/model
pi --provider openai --model gpt-4o-mini -p "Your task"
```

## Background Execution with tmux

For longer tasks, use tmux to run agents in the background:

```bash
SOCKET="${TMPDIR:-/tmp}/coding-agent.sock"
SESSION="codex-task"

tmux -S "$SOCKET" new -d -s "$SESSION"
tmux -S "$SOCKET" send-keys -t "$SESSION" "cd ~/project && codex --yolo 'Build feature X'" Enter

# Monitor progress
tmux -S "$SOCKET" capture-pane -p -t "$SESSION" -S -200

# Check if done (look for shell prompt)
tmux -S "$SOCKET" capture-pane -p -t "$SESSION" -S -3 | grep -q "❯"
```

## Parallel Issue Fixing with git worktrees

For fixing multiple issues in parallel:

```bash
# 1. Create worktrees for each issue
git worktree add -b fix/issue-78 /tmp/issue-78 main
git worktree add -b fix/issue-99 /tmp/issue-99 main

# 2. Launch Codex in each
cd /tmp/issue-78 && pnpm install && codex --yolo "Fix issue #78: <description>"
cd /tmp/issue-99 && pnpm install && codex --yolo "Fix issue #99: <description>"

# 3. Create PRs after fixes
cd /tmp/issue-78 && git push -u origin fix/issue-78
gh pr create --repo user/repo --head fix/issue-78 --title "fix: ..." --body "..."

# 4. Cleanup
git worktree remove /tmp/issue-78
git worktree remove /tmp/issue-99
```

## Rules

1. **Respect tool choice** - if user asks for Codex, use Codex
2. **Be patient** - don't kill sessions because they're "slow"
3. **--full-auto for building** - auto-approves changes
4. **Parallel is OK** - run many processes at once for batch work
5. **Never start agents in your own project folder** - use separate directories

## Tips

- **Git repo required:** Codex won't run outside a git directory
- **exec is your friend:** `codex exec "prompt"` runs and exits cleanly
- Use separate git worktrees for parallel fixes (no branch conflicts)
- `pnpm install` first before running codex in fresh clones
