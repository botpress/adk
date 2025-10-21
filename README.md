# Botpress Agent Development Kit (ADK)

The Botpress Agent Development Kit (ADK) is a high-level TypeScript framework for building AI agents on the Botpress platform.

## Installation

### Quick Install (Recommended)

**macOS & Linux:**

```bash
curl -fsSL https://raw.githubusercontent.com/botpress/adk/main/install.sh | bash
```

**Windows (PowerShell as Administrator):**

```powershell
$version = "1.2.0"  # Replace with latest version
Invoke-WebRequest -Uri "https://github.com/botpress/adk/releases/download/v$version/adk-windows-x64.zip" -OutFile "adk.zip"
Expand-Archive -Path "adk.zip" -DestinationPath "$env:USERPROFILE\.adk"
$env:PATH += ";$env:USERPROFILE\.adk"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
```

### Manual Installation

Download the appropriate binary for your platform from the [latest release](https://github.com/botpress/adk/releases/latest):

- **macOS (Apple Silicon)**: `adk-darwin-arm64.tar.gz`
- **macOS (Intel)**: `adk-darwin-x64.tar.gz`
- **Linux**: `adk-linux-x64.tar.gz`
- **Windows**: `adk-windows-x64.zip`

Then extract and move to your PATH:

```bash
# macOS/Linux
tar -xzf adk-*.tar.gz
sudo mv adk-* /usr/local/bin/adk
chmod +x /usr/local/bin/adk
```

### Install via npm

```bash
npm install -g @botpress/adk-cli@alpha
# or
bun add -g @botpress/adk-cli@alpha
```

## Getting Started

### 1. Create a New Agent

```bash
adk init my-agent
cd my-agent
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Start Development

```bash
adk dev
```

The development server will start, and your agent will be ready for testing.

### 4. Deploy Your Agent

```bash
adk deploy
```

## Project Structure

When you run `adk init`, you'll get a project with this structure:

```
my-agent/
├── agent.config.ts      # Agent configuration
├── dependencies.json    # Integration dependencies
├── src/
│   ├── actions/        # Callable functions
│   ├── workflows/      # Long-running processes
│   ├── conversations/  # Conversation handlers
│   ├── tables/         # Data storage
│   ├── triggers/       # Event subscriptions
│   └── knowledge/      # Knowledge base files
└── package.json
```

## CLI Commands

- `adk init <name>` - Create a new agent project
- `adk dev` - Start development server with hot reload
- `adk build` - Build your agent for deployment
- `adk deploy` - Deploy your agent to Botpress
- `adk login` - Authenticate with Botpress
- `adk --help` - Show all available commands

## Features

- **TypeScript First**: Full type safety and IntelliSense
- **Hot Reload**: See changes instantly during development
- **Convention-Based**: Clear patterns with minimal boilerplate
- **Integrated Tooling**: Built-in commands for all development tasks
- **Deploy Anywhere**: One command to deploy to Botpress Cloud

## Documentation

- [ADK Documentation](https://botpress.com/docs/adk) (Coming Soon)
- [Botpress Platform](https://botpress.com)
- [Community Discord](https://discord.gg/botpress)

## Requirements

- **Node.js**: 22.0.0 or higher
- **Package Manager**: Bun, npm, or yarn
- **Botpress Account**: [Sign up for free](https://app.botpress.cloud)

## Support

- 📖 [Documentation](https://botpress.com/docs)
- 💬 [Discord Community](https://discord.gg/botpress)
- 🐛 [Report Issues](https://github.com/botpress/adk/issues)

## License

MIT © Botpress

---

**Note**: The ADK is currently in alpha. Features and APIs may change.
