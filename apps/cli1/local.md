# cli1 — Service Migration from cli

Map of all cli services, their Feathers methods, CLI commands, and REST equivalents.
Use this to track what needs to be ported to cli1's Tier 1 architecture.

## Route Structure

Everything that operates on a keyboard nests under `keyboards/:id`.
Status is not a separate service — it's an enrichment hook on `keyboards` responses.

```
keyboards                     GET     → list all
keyboards/:id                 GET     → get one (includes CI status)
keyboards/:id/firmware        POST    → download
keyboards/:id/firmware        PATCH   → flash
keyboards/:id/draw            POST    → draw SVG

parse                         POST    → parse keymap.c (file-based, not keyboard-scoped)
log                           GET     → show events (infrastructure)
```

| Service path | Methods | Tier |
|---|---|---|
| `keyboards` | find, get | 1 |
| `keyboards/:id/firmware` | create, patch | 1 |
| `keyboards/:id/draw` | create | 1 |
| `parse` | create | 1 |
| `log` | find | 3 |

## Services (cli reference)

### keyboards

| Method | CLI command | REST | Description |
|--------|-------------|------|-------------|
| `find` | `list`, `l` | `GET /keyboards` | List all keyboards from config |
| `get` | (internal) | `GET /keyboards/:id` | Get one keyboard config |

**Tier**: 1 (domain)
**Status**: ported to cli1

---

### firmware

| Method | CLI command | REST | Description |
|--------|-------------|------|-------------|
| `find` | `status`, `s` | `GET /firmware` | CI status for all workflows |
| `get` | `status <kb>` | `GET /firmware/:keyboard` | CI status for one keyboard |
| `create` | `get`, `g` | `POST /firmware` | Download/cache firmware artifact |
| `patch` | `flash`, `f` | `PATCH /firmware/:keyboard` | Download + flash to hardware |

**Tier**: 1 (domain)
**Hooks** (before):
- `checkGithubAuth` — fail fast on missing token
- `resolveConfig` — inject github/keyboard config into params
- `validateKeyboard` — check keyboard exists
- `resolveRunId` — wait for CI run, resolve run ID
- `checkCache` — short-circuit on cache hit (`create` only)

**Hooks** (after):
- `writeCache` — write stamp file after download (`create` only)

---

### keyboards/:keyboardId/draw

| Method | CLI command | REST | Description |
|--------|-------------|------|-------------|
| `create` | `draw`, `d` | `POST /keyboards/:id/draw` | Draw keymap SVG for one keyboard |

**Tier**: 1 (domain)
**Hooks** (before):
- `resolveKeyboardFromRoute` — resolve `:keyboardId` route param

---

### parse

| Method | CLI command | REST | Description |
|--------|-------------|------|-------------|
| `create` | `parse`, `p` | `POST /parse` | Parse keymap.c to JSON via tree-sitter |

**Tier**: 1 (domain)
**Hooks** (before):
- `initParser` — lazy-load tree-sitter WASM

---

### log

| Method | CLI command | REST | Description |
|--------|-------------|------|-------------|
| `find` | `log [n]` | `GET /log` | Show last n event log entries |
| `create` | (internal) | `POST /log` | Write event to log DB |

**Tier**: 3 (hybrid — CLI debug view, not for agents)
**Note**: Infrastructure service used by global hooks. `create` is internal only.

---

## Global Hooks (all services)

| Phase | Hook | Description |
|-------|------|-------------|
| `before` | `createLogHook("before")` | Log service call start |
| `after` | `createLogHook("after")` | Log service call completion |
| `error` | `createLogHook("error")` | Log service call failure |

## Migration Checklist

- [x] keyboards — `find` ported with Ink component
- [ ] firmware — `find`/`get` (status), `create` (download), `patch` (flash)
- [ ] draw — `create` (keymap SVG)
- [ ] parse — `create` (tree-sitter)
- [ ] log — `find` (debug view)
- [ ] global log hooks
- [ ] MCP provider after hook
