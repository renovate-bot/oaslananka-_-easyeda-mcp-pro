# Installation & Configuration Guide

This guide outlines the system requirements and setup options for `easyeda-mcp-pro`.

---

## 1. System Requirements

- **Node.js**: `Node.js >= 24 < 27` (required for modern ESM features).
- **pnpm**: `pnpm >= 11` (required for development workflows; not needed for npx-only usage).
- **EasyEDA Pro**: Desktop Client or Web Editor (tested with version 2.2.x).

---

## 2. Interactive Auto-Setup (CLI)

The easiest way to set up the MCP server is using our built-in configuration utility. It automatically detects and modifies the settings files for your installed clients.

```bash
# Configure all detected MCP clients in your user directory
npx easyeda-mcp-pro setup all

# Or configure a specific client (e.g. Cursor or Claude Desktop)
npx easyeda-mcp-pro setup cursor
npx easyeda-mcp-pro setup claude
```

### Options:

- `--profile <name>`: Restrict or expand the toolset. Options are `core` (default), `pro`, `full`, or `dev`.
  E.g. `npx easyeda-mcp-pro setup cursor --profile full`

---

## 3. Manual Client Configurations

If you prefer to configure your client manually, append the following configurations to the respective settings files:

### 🟣 Claude Desktop

**Config Path**:

- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "easyeda-mcp-pro": {
      "command": "npx",
      "args": ["-y", "easyeda-mcp-pro@latest"],
      "env": {
        "TOOL_PROFILE": "core"
      }
    }
  }
}
```

### 🔵 Cursor IDE

**Config Path**: Project-specific `.cursor/mcp.json` or global settings.

```json
{
  "mcpServers": {
    "easyeda-mcp-pro": {
      "command": "npx",
      "args": ["-y", "easyeda-mcp-pro@latest"],
      "env": {
        "TOOL_PROFILE": "pro"
      }
    }
  }
}
```

### 🟢 VS Code (GitHub Copilot)

**Config Path**: `%APPDATA%\Code\User\mcp.json` (Windows) or `~/Library/Application Support/Code/User/mcp.json` (macOS).

```json
{
  "servers": {
    "easyeda-mcp-pro": {
      "command": "npx",
      "args": ["-y", "easyeda-mcp-pro@latest"],
      "env": {
        "TOOL_PROFILE": "pro"
      }
    }
  }
}
```

---

## 4. EasyEDA Pro Extension Installation

To bridge the MCP server with the live EasyEDA Pro layout editor:

1. Open your terminal and copy/open the extension directory:
   ```bash
   npx easyeda-mcp-pro extension --open
   ```
   This opens the folder containing `easyeda-bridge-extension.eext`.
2. Open **EasyEDA Pro**.
3. Go to **Settings** → **Extensions** → **Extension Manager**.
4. Click **Import Extension** and select the `easyeda-bridge-extension.eext` file.
5. In the Extension Manager, verify that **Allow External Interaction** is checked for the imported extension.
6. Click **MCP Bridge** → **Connect** in the top menu bar to start the WebSocket connection.
