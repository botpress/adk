# Botpress Agent Development Kit (ADK)

The Botpress Agent Development Kit (ADK) is a high-level TypeScript framework for building AI agents on the Botpress platform.

### Quick Install

**macOS & Linux**
```bash
curl -fsSL https://github.com/botpress/adk/releases/latest/download/install.sh | bash
```

**Windows (PowerShell)**
```powershell
powershell -c "irm https://github.com/botpress/adk/releases/latest/download/install.ps1 | iex"
```

### Manual Installation

<details>
<summary>Click to expand manual install instructions</summary>

**macOS (Apple Silicon)**
```bash
curl -fsSL https://github.com/botpress/adk/releases/download/v1.4.2/adk-darwin-arm64.tar.gz | tar -xz
sudo mv adk-darwin-arm64 /usr/local/bin/adk
adk --version
```

**macOS (Intel)**
```bash
curl -fsSL https://github.com/botpress/adk/releases/download/v1.4.2/adk-darwin-x64.tar.gz | tar -xz
sudo mv adk-darwin-x64 /usr/local/bin/adk
adk --version
```

**Linux (x64)**
```bash
curl -fsSL https://github.com/botpress/adk/releases/download/v1.4.2/adk-linux-x64.tar.gz | tar -xz
sudo mv adk-linux-x64 /usr/local/bin/adk
adk --version
```

**Windows (Manual)**
```powershell
Invoke-WebRequest -Uri "https://github.com/botpress/adk/releases/download/v1.4.2/adk-windows-x64.zip" -OutFile "adk.zip"
Expand-Archive -Path "adk.zip" -DestinationPath "$env:LOCALAPPDATA\Programs\adk"
$env:PATH += ";$env:LOCALAPPDATA\Programs\adk"
[Environment]::SetEnvironmentVariable("PATH", $env:PATH, "User")
adk --version
```

</details>

### Getting Started

```bash
# 1. Install ADK
curl -fsSL https://github.com/botpress/adk/releases/latest/download/install.sh | bash

# 2. Create a new agent
adk init my-agent

# 3. Select "Blank" template
# 4. Choose your package manager: npm / pnpm / bun

# 5. Install dependencies
# (choose one based on your package manager)
npm install
# or
pnpm install
# or
bun install

# 6. Install required Botpress packages
npm i @botpress/sdk@4.17.1 @botpress/runtime@1.3.4
# or
pnpm add @botpress/sdk@4.17.1 @botpress/runtime@1.3.4
# or
bun add @botpress/sdk@4.17.1 @botpress/runtime@1.3.4

# 7. Install the Botpress CLI globally
npm install -g @botpress/cli@4.15.0
# (use sudo if required)

# 8. Log in and link your agent
adk login
adk link
# Select "Create new Bot" when prompted

# 9. Add the chat capability
adk install chat

# 10. Update your agent files
# - Edit conversation/index.ts
# - Edit agent.config.ts

# 11. Start local development
adk dev

12. (In a new terminal) Chat with your agent
adk chat
```

### Documentation

- [ADK Documentation](https://botpress.com/docs/adk)
- [Botpress Platform](https://botpress.com)
