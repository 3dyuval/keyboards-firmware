# MCP Sidecar

The `apps/cli1/mcp.ts` entry point exposes keyboard services over [Model Context Protocol](https://modelcontextprotocol.io) via stdio. It compiles to a standalone binary with no filesystem config — all keyboard data comes through tool params.

## Compile

```sh
cd apps/cli1
bun build mcp.ts --compile --outfile keyb-mcp
```

Output: `apps/cli1/keyb-mcp` (~50 MB standalone binary).

## Tools exposed

| Tool              | Method   | Description                              |
|-------------------|----------|------------------------------------------|
| `List Keyboards`  | `find`   | List configured keyboards (filter by type) |
| `Draw Keymap`     | `create` | Generate keymap SVG for a keyboard       |

Tools are auto-discovered from `*.mcp.ts` files registered in `mcp.ts`. To add a tool, create a `<service>.mcp.ts` and register it in the static imports section.

## Tauri sidecar

### 1. Copy binary to `src-tauri/binaries/`

Tauri expects sidecar binaries named with a target triple suffix:

```sh
cp apps/cli1/keyb-mcp /path/to/src-tauri/binaries/keyb-mcp-x86_64-unknown-linux-gnu
```

### 2. Register in `tauri.conf.json`

```json
{
  "bundle": {
    "externalBin": ["binaries/keyb-mcp"]
  }
}
```

### 3. Spawn as stdio MCP client

```rust
use tauri::api::process::Command;

let (mut rx, mut child) = Command::new_sidecar("keyb-mcp")
    .expect("failed to create sidecar command")
    .spawn()
    .expect("failed to spawn sidecar");
```

Or from the JS side using `@tauri-apps/api/shell`:

```ts
import { Command } from "@tauri-apps/plugin-shell";

const cmd = Command.sidecar("binaries/keyb-mcp");
const child = await cmd.spawn();
```

The binary communicates over stdin/stdout using JSON-RPC (MCP stdio transport). Use any MCP client SDK to send `tools/list` and `tools/call` requests.

### 4. Example: call a tool

```jsonc
// → stdin
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }

// ← stdout
{ "jsonrpc": "2.0", "id": 1, "result": { "tools": [...] } }

// → stdin
{ "jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
  "name": "Draw Keymap",
  "arguments": { "keyboard": "eyelash_corne" }
}}
```

## Claude Code / Claude Desktop

Add to `.claude/settings.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "keyb": {
      "command": "/absolute/path/to/keyb-mcp",
      "type": "stdio"
    }
  }
}
```

## Dev mode (no compile)

```sh
cd apps/cli1
bun mcp.ts
```

Or via the main entry point:

```sh
bun index.tsx --mcp
```

The `--mcp` flag uses the full config-aware app (reads `config/default.ts` + `config/local.json`), while `mcp.ts` is config-free for standalone distribution.

## Architecture

```
mcp.ts (standalone)          index.tsx --mcp (dev)
  │                            │
  ├─ static imports            ├─ dynamic service scan
  ├─ no config files           ├─ reads config/
  ├─ empty keyboards{}         ├─ full keyboards config
  │                            │
  └──── startMcpServer(app) ───┘
           │
           ├─ collectMcpTools() — reads expose.mcp from services
           ├─ ListToolsRequestSchema → tool list from *.mcp.ts
           ├─ CallToolRequestSchema → routes to service method
           ├─ mcpPresenter hook — consumes async generators
           └─ mcpErrorHandler hook — returns { isError, content }
```

## Adding a new MCP tool

1. Create `src/<service>/<service>.mcp.ts`:

```ts
import { MySchema } from "./<service>.schema.ts";

export default {
  tool: "My Tool",
  description: "What it does",
  resolves: "create",  // feathers method: find | get | create | patch | update
  schema: MySchema,
};
```

2. Register in `mcp.ts`:

```ts
import MyService from "./src/<service>/<service>.service.ts";
import myHooks from "./src/<service>/<service>.hooks.ts";
import myMcp from "./src/<service>/<service>.mcp.ts";

const my = new MyService(app);
(my as any).expose = { mcp: myMcp };
app.use("<service>", my);
app.service("<service>").hooks(myHooks);
```
