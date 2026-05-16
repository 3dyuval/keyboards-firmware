# MCP Firmware Flash Flow

## Goal

Flash firmware via MCP with an explicit, auditable source — no silent resolution fallback.
Caller resolves first, inspects the path, then flashes with a known artifact.

## Flow

```mermaid
flowchart LR
    list["keyboard-list\n(find)"]
    get["firmware-get\n(create)"]
    flash["firmware-flash\n(patch)"]

    list -->|"artifact name"| get
    get -->|"local path (.uf2/.bin)"| flash
```

**Why explicit path:** `firmware-flash` accepts either an artifact name (triggers
resolution chain) or a file path (skips it entirely). Passing the path returned by
`firmware-get` makes the source auditable — you know exactly which file was flashed.

## Step by Step

### 1. List available keyboards

```
keyboard-list
```

Returns each keyboard's artifact name, type (zmk/qmk), and workflow.
Use this to find the correct artifact name (e.g. `totem-left`).

### 2. Resolve and download firmware

```
firmware-get { artifact: "totem-left" }
```

Resolution order: local build (`.cache/local/`) → CI cache (`.cache/ci/`) → GitHub latest run.
Returns `{ path: "/abs/path/to/totem-left.uf2", source, runId? }`.

### 3. Flash with explicit path

```
firmware-flash { artifact: "/abs/path/to/totem-left.uf2", yes: true }
```

Passing the absolute path bypasses the resolution chain entirely — no ambiguity about source.
Put the keyboard in bootloader mode (double-tap reset) before calling.

## Tool Reference

| Tool | Method | Key args |
|---|---|---|
| `keyboard-list` | `find` | `type?` — filter by zmk/qmk |
| `firmware-get` | `create` | `artifact` — name or path |
| `firmware-flash` | `patch` | `artifact` — name or **path**; `yes`, `reset`, `source`, `run` |
