# CLI Config Resolution

All config values resolve from an ordered set of sources. The first defined source wins.

```
R(x) = S1(x) ?? S2(x) ?? ... ?? Sn(x)
```

---

## Static config (node-config)

Loaded once at startup via `@feathersjs/configuration`. Sources in precedence order:

| Priority | Source | File |
|----------|--------|------|
| 1 | `local.json` | `apps/cli/config/local.json` |
| 2 | `default.ts` | `apps/cli/config/default.ts` |

`local.json` is gitignored — use it for secrets and per-machine overrides.

### Resolution matrix

```
              local.json    default.ts
root          —             git rev-parse --show-toplevel
cacheDir      —             {root}/.cache/firmware
draw.outputDir —            {root}/keymap-drawer
draw.config   —             {root}/keymap-drawer/config.yaml
github.owner  yes           "" (empty)
github.repo   yes           "" (empty)
keyboards     yes           {} (empty → triggers discovery)
logging       —             per-service defaults
```

`github.owner` and `github.repo` **must** be set in `local.json` — the defaults are empty strings and will cause GitHub API calls to fail silently.

### GitHub auth token

Not in node-config. Resolved at runtime in `gh.ts`:

```
R(githubToken) = GITHUB_TOKEN ?? GH_TOKEN ?? GITHUB_AUTH_TOKEN ?? app.get("githubAuthToken")
```

Set `GITHUB_TOKEN` in your shell env or add `"githubAuthToken"` to `local.json`.

---

## `keyboards` — three-stage discovery

`keyboards` has its own resolution chain beyond static config, implemented in `keyboard-hooks.ts:getKeyboards()`.

```
R(keyboards) = local.json ?? build.yaml ?? GitHub API
```

### Stage 1 — `local.json` (explicit, highest precedence)

If `keyboards` is non-empty in `local.json`, it is used as-is. No network, no file scanning.

```json
{
  "github": { "owner": "3dyuval", "repo": "keyboards-firmware" },
  "keyboards": {
    "corne":   { "workflow": "build-zmk.yml", "artifact": "corne",   "type": "zmk" },
    "eyelash": { "workflow": "build-zmk.yml", "artifact": "eyelash", "type": "zmk" },
    "totem":   { "workflow": "build-zmk.yml", "artifact": "totem",   "type": "zmk" }
  }
}
```

Each entry shape (`KeyboardSchema`):

| Field | Description |
|-------|-------------|
| `workflow` | GitHub Actions workflow file (e.g. `build-zmk.yml`) |
| `artifact` | Base artifact name — matches job names in CI (e.g. `totem` matches `zmk / Build (..., totem-left)`) |
| `type` | `"zmk"` or `"qmk"` |
| `keymap` | Optional path to keymap file |

### Stage 2 — `build.yaml` (local, auto-derived)

If `keyboards` is empty in config, `build.yaml` at the repo root is parsed. Entries are grouped by base artifact name (stripping `-left`/`-right`). `settings-reset-*` entries are skipped.

All entries are assumed `type: zmk`, `workflow: build-zmk.yml`. This covers all standard ZMK user config repos.

**Advantage**: adding a keyboard to `build.yaml` makes it immediately available to the CLI — no `local.json` update needed.

**Limitation**: hardcodes `build-zmk.yml` as the workflow. QMK keyboards or custom workflows require Stage 1.

### Stage 3 — GitHub API (remote, fallback)

If neither `local.json` nor `build.yaml` yields keyboards, the CLI queries GitHub for the latest successful run of `build-zmk.yml` and `build-qmk.yml`, then derives keyboard names from artifact names.

**Known issue**: the ZMK reusable workflow (`zmkfirmware/zmk/.github/workflows/build-user-config.yml`) produces a merged `firmware` artifact in addition to per-keyboard artifacts. This merged artifact is not a keyboard and will produce incorrect entries. Stage 1 or 2 are preferred for this reason.

Requires `GITHUB_TOKEN` and correct `github.owner`/`github.repo` in `local.json`. Times out after 10s.

---

## Artifact matching

`config.artifact` is a **base name** (e.g. `eyelash`). Actual CI artifacts and job names always include a side suffix.

### Download (`flash`)

```
artifact lookup = "${config.artifact}-${side}"   // e.g. "eyelash-left"
fallback        = "${config.artifact}"            // e.g. "eyelash" — does not exist for split keyboards
```

`side` is declared optional in `FirmwareFlashSchema` but is effectively **required for all ZMK split keyboards** — every keyboard in `build.yaml` produces `-left` / `-right` artifacts, never a bare base name. Omitting `side` will always fail with `artifact "eyelash" not found`.

Correct invocation:
```
bun cli flash eyelash left
bun cli flash eyelash right
```

### Status (job filter)

```
job filter = j.name.includes(config.artifact)    // "eyelash" matches "zmk / Build (..., eyelash-left)"
```

Substring match works here because job names embed both `eyelash-left` and `eyelash-right`, both containing the base name.

### Full name mapping

| `config.artifact` | CI artifact names | CI job names |
|-------------------|-------------------|--------------|
| `eyelash` | `eyelash-left`, `eyelash-right` | `zmk / Build (..., eyelash-left)`, `zmk / Build (..., eyelash-right)` |
| `totem` | `totem-left`, `totem-right` | `zmk / Build (..., totem-left)`, `zmk / Build (..., totem-right)` |
| `corne` | `corne-left`, `corne-right` | `zmk / Build (..., corne-left)`, `zmk / Build (..., corne-right)` |

The merged `firmware` artifact (produced by the upstream ZMK reusable workflow) has no corresponding keyboard entry and is ignored by all lookup paths.

---

## Keyboard name resolution (per-command)

When a command receives a keyboard name (e.g. `flash eyelash`), `resolveKeyboard()` looks it up:

```
R(keyboardName) = params.keyboard ?? route.keyboardId ?? context.id ?? data.keyboard
```

If the name is not found in the keyboards map, `validateKeyboard()` throws:

```
Error: unknown keyboard "eyelash" — not in config
```

This means Stage 1/2/3 above did not produce an entry for that name.
