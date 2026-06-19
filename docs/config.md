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
    "totem":   { "workflow": "build-zmk.yml", "artifact": "totem",   "type": "zmk" },
    "klor":    { "workflow": "build-qmk.yml", "artifact": "klor",    "type": "qmk" }
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
| `klor` | `geigeigeist_klor_graphite` | `qmk / Build (..., geigeigeist/klor:graphite)` |

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

---

## Flash presets

Flash presets define **how** firmware files are flashed to hardware. They live in `config/default.ts` under `flashPresets` and are resolved per-keyboard via the `flash.preset` field in `local.json`.

### Architecture: 3 families, 2 flash methods

```
┌─────────────────┬──────────────┬─────────────────────────────────┐
│ Family          │ Flash method │ Drive label(s)                  │
├─────────────────┼──────────────┼─────────────────────────────────┤
│ RP2040          │ mass-storage │ RPI-RP2                         │
│ nRF52840 (UF2)  │ mass-storage │ FEATHERBOOT                     │
│ nRF52840 (DFU)  │ dfu          │ — (device VID:PID required)     │
│ ZMK (generic)   │ mass-storage │ NICENANO, XIAO-SENSE            │
└─────────────────┴──────────────┴─────────────────────────────────┘
```

**Mass-storage** flash copies the firmware file to a USB mass-storage drive. The board auto-flashes on copy:
- **RP2040**: Renames `.bin` → `.uf2` to trigger auto-reset (the RP2040 bootloader watches for .uf2 files).
- **nRF52840 Feather (UF2)**: Copies directly — the Adafruit UF2 bootloader does NOT auto-reset on copy, but still flashes from .uf2.
- **ZMK (nice!nano / XIAO-SENSE)**: Copies `.uf2` files; ZMK bootloader flashes and resets automatically.

**DFU** flash uses `dfu-util` to program a `.bin` file directly to the nRF52840's flash via USB DFU mode (double-tap reset). Requires `device` (VID:PID) and `address` in the preset.

### Built-in presets

| Preset name | Method | Labels / Device | Use case |
|---|---|---|---|
| `rp2040` | mass-storage | `RPI-RP2` | RP2040-based keyboards (Klor RP2040, Pro Micro clones) |
| `dfu` | dfu | `0483:df11`, address `0x08000000` | nRF52840 in DFU mode (nice!nano v2, XIAO-SENSE) |
| `feather-nrf52840` | mass-storage | `FEATHERBOOT` | Adafruit Feather nRF52840 Express (UF2 bootloader, ZMK builds produce `.bin`) |
| `zmk` | mass-storage | `NICENANO`, `XIAO-SENSE` | Generic ZMK keyboards on Nordic nRF52840 |

### Per-keyboard flash config

Each keyboard in `local.json` declares its flash preset:

```json5
{
  "keyboards": {
    "klor-rp2040": {
      "flash": { "preset": "rp2040" }
    },
    "klor-nrf52840": {
      "flash": { "preset": "feather-nrf52840" }
    },
    "iris": {
      "flash": { "preset": "dfu" }
    }
  }
}
```

The preset is merged with any per-keyboard overrides (e.g. custom `device` or `label`). If a keyboard has no `flash` config, the CLI throws:

```
Error: no flash configuration for keyboard "klor" — add to local.json
```

If the preset name doesn't exist in `default.ts`:

```
Error: unknown flash preset "foo" for keyboard "klor" — defined in config/default.ts
```

### QMK build → flash flow

QMK's `make` produces different output formats depending on `CONVERT_TO` in `rules.mk`:

| `CONVERT_TO` | Output | Flash preset |
|---|---|---|
| `rp2040_ce` | `.uf2` (auto-converted via `uf2conv.py`) | `rp2040` |
| `nice_nano` | `.hex` → needs conversion to `.uf2` | `feather-nrf52840` or `dfu` |

For nRF52840 keyboards that need UF2 flashing (Feather), the QMK build script converts `.hex` → `.uf2` using `uf2conv.py -f nrf52840` after compilation. The resulting artifact is a `.uf2` file ready for mass-storage flash.
