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

## CLI Routing (done)

Flat commands, file-per-command. Filename IS the command.

```
firmware.status.cli.tsx  → command: "status"
firmware.flash.cli.tsx   → command: "flash"
firmware.get.cli.tsx     → command: "get"
keyboards.list.cli.tsx   → command: "list"
```

Each file exports: `default` (component), `description`, `aliases?`, `args?`, `schema?`.
No manual command strings — `deriveCommand(filename, base)` strips `{base}.` prefix and `.cli.tsx` suffix.

Flags derived from Zod schema via `flagsFromSchema()` — shared primitive used by
`parseArgs`, `routeUsage`, and `--discover`. Schema `.meta({alias, description})` carries
metadata via `z.globalRegistry`.

`--discover` for human-readable, `--discover --json` for agent consumption.

### Command map

```
keyb1 list                        → keyboards.find()
keyb1 status                      → firmware.find()
keyb1 get <kb>                    → firmware.create({keyboard})
keyb1 flash <kb> [side] [-y] [-r] → firmware.patch(kb, {side, yes, reset})
keyb1 draw <kb>                   → draw.create({keyboard})
keyb1 parse                       → parse.create()
keyb1 log [n]                     → log.find({$limit: n})
```

### useService.call signature

`call(method, ...args)` spreads args through to the Feathers service method.
Injects `provider: "cli"` into the last object argument.

## Async Iterator Patterns (done)

- `scan()` — async generator, yields DiscoveredService lazily
- `registerServices()` — yields RegistrationEvent for boot progress
- `firmware.find/get` — stale-while-revalidate (yield cached, then fresh)
- `firmware.create` — download progress stages
- `firmware.patch` — full flash pipeline (download → wait → flash)
- `keyboards.find` — progressive enrichment (names first, details later)
- `hw.flashZmk/flashQmk` — stage-by-stage flash progress

## Infrastructure (done)

- `github(app)` factory — Octokit singleton on app, reads owner/repo from config
- `<Table>` component — `<Box width>` layout, per-row color functions
- `flagsFromSchema()` — shared primitive: Zod shape → flag definitions (uses `z.globalRegistry` + `.meta()`)
- `unwrapToBase()` / `isOptionalOrDefaulted()` — recursive Zod v4 type unwrapping
- `--discover` / `--discover --json` — CLI self-documentation from route registry
- MCP server mode (`--mcp`) — stdio transport, tools from `expose.mcp` declarations
- `mcpPresenter` after hook — consumes async generators, shapes tool results
- `z.toJSONSchema()` for MCP inputSchema (Zod v4 native, replaces zod-to-json-schema)
- Config resolves relative to package via `NODE_CONFIG_DIR` (cwd-agnostic)

### Directory layout

```
lib/                    — package-level plumbing (not domain)
  context.tsx           — AppContext, RootContext, useService hook
  discover.ts           — --discover flag output
  mcp.ts                — MCP hooks + stdio server
  register.ts           — service auto-discovery and registration
  route.ts              — types, schema introspection, traversal, arg parsing
src/
  app.ts                — Feathers app instance + BaseService
  components/
    table.tsx           — <Table> component
  firmware/             — firmware domain service
  keyboards/            — keyboards domain service
index.tsx               — entry point, mode dispatch
```

## Caveats & Gotchas

### Zod v4 differences
- `._def` is deprecated — use `.unwrap()`, `.isOptional()`, `z.globalRegistry`
- `.meta({...})` + `z.globalRegistry.get(field)` for schema metadata (replaces `.describe()` hack)
- `z.toJSONSchema(schema)` built-in — replaces `zod-to-json-schema` (which doesn't support v4)
- `ZodEnum.options` (array) instead of `._def.values`
- `.unwrap()` returns `$ZodType` — cast to `z.ZodTypeAny` at call sites
- `isOptionalOrDefaulted()` recursive check replaces deprecated `.isOptional()`

### Feathers + async generators
- Feathers hooks run on the service method call, not on each yield. The generator
  returned by the method IS `context.result`. Hooks see the generator object, not
  individual events. After hooks that inspect `context.result` will see the generator.
- `checkCache` sets `context.params._cached = true` instead of `context.result` —
  the generator checks `params._cached` and short-circuits with a cached yield.

### File-per-command naming
- `{base}.cli.tsx` → command defaults to `base` (the folder name)
- `{base}.{command}.cli.tsx` → command is `{command}`
- All cli files MUST start with `{base}.` to be discovered (scanner filters by prefix)
- Default export required — named exports are not picked up as the component

### useService.call spread args
- `call("find")` → `service.find({ provider: "cli" })`
- `call("create", data, params)` → `service.create(data, { ...params, provider: "cli" })`
- `call("patch", id, data, params)` → `service.patch(id, data, { ...params, provider: "cli" })`
- Provider injection assumes the last argument is a params object. If the last arg
  is a primitive or array, a new params object is appended instead.

### Missing config
- `cacheDir` not in `config/default.json` — firmware hooks crash on `join(undefined, ...)`
- `status <kb>` route not wired — `firmware.get` needs a separate CLI file if needed

## Migration Checklist

- [x] keyboards — `find` with progressive enrichment generator
- [x] firmware — service + hooks + gh factory + hw generators
- [x] firmware — `find`/`get` (status with stale-while-revalidate)
- [x] firmware — `create` (download with progress)
- [x] firmware — `patch` (flash with stage progression)
- [x] firmware — CLI components: status, flash, get
- [x] routing — file-per-command, parseArgs, flagsFromSchema, --discover
- [x] move context.tsx, discover.ts, route.ts to src/lib/
- [x] move resolveCommand from index.tsx to src/lib/route.ts
- [ ] add `cacheDir` to config/default.json
- [x] fix .gitignore: `/firmware` anchored to root, `**/config/local.json` ignored
- [x] move BaseService into src/app.ts (deleted base-service.ts)
- [x] move lib/ to package root (plumbing, not domain)
- [x] move table.tsx to src/components/
- [x] MCP provider after hook + stdio server (`--mcp` mode)
- [x] MCP tool: list_keyboards with z.toJSONSchema input schema
- [ ] draw — service + CLI component
- [ ] parse — service + tree-sitter hooks
- [ ] log — service + SQLite + global hooks
- [ ] global log hooks
- [ ] replace `parseArgs` with Commander via `buildCommand` (Pastel pattern)
