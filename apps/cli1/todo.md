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

## CLI Routing

Flat commands, not nested. The user types `keyb1 flash`, not `keyb1 firmware flash`.

Each `*.cli.tsx` exports a `routes: Route[]` array (or legacy single `command` + component).
Discovery normalizes both shapes into `expose.cli: Route[]`.

```ts
// src/route.ts
interface Route {
  command: string;
  aliases?: string[];
  description: string;
  args?: { name: string; required?: boolean }[];
  flags?: Record<string, { type: "boolean" | "string"; short?: string; default?: any }>;
  schema?: ZodType;       // validates merged args+flags
  component: FC<any>;
}
```

Argv parsing uses Node's built-in `util.parseArgs` — zero dependencies.
Parsed args pass as props to the Ink component: `<Component {...parsedArgs} />`.
Zod schema validates before render.

### Command map

```
keyb1 list                        → keyboards.find()
keyb1 status                      → firmware.find()
keyb1 status <kb>                 → firmware.get(kb)
keyb1 get <kb>                    → firmware.create({keyboard})
keyb1 flash <kb> [side] [-y] [-r] → firmware.patch(kb, {side, yes, reset})
keyb1 draw <kb>                   → draw.create({keyboard})
keyb1 parse                       → parse.create()
keyb1 log [n]                     → log.find({$limit: n})
```

### useService.call signature

Current `call(method, data?, params?)` maps to `service[method](data, params)`.
Needs to support id-bearing methods: `call("patch", id, data, params)` for Feathers'
`patch(id, data, params)` / `get(id, params)` signatures. Spread args through.

### Multi-command per service

firmware.cli.tsx exports `routes: Route[]` with 3 entries (status, flash, get).
Each route maps to its own component + Feathers method.
Single-command services (keyboards, log) keep the simple shape — discover normalizes.

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
- `<Table>` component — `<Box width>` layout, per-row color functions, replaces pad()
- Unknown command error feedback in index.tsx

## Migration Checklist

- [x] keyboards — `find` with progressive enrichment generator
- [x] firmware — service + hooks + gh factory + hw generators
- [x] firmware — `find`/`get` (status with stale-while-revalidate)
- [x] firmware — `create` (download with progress)
- [x] firmware — `patch` (flash with stage progression)
- [ ] firmware — CLI components for flash + get (status done)
- [ ] routing — Route type, parseArgs, multi-command discover
- [ ] draw — service + CLI component
- [ ] parse — service + tree-sitter hooks
- [ ] log — service + SQLite + global hooks
- [ ] global log hooks
- [ ] MCP provider after hook
- [ ] move context.tsx and discover.ts to src/utils/
- [ ] move base-service.ts to src/app.ts (co-locate with app)
- [ ] move resolveCommand from index.tsx to src/utils/
