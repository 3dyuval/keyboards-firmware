# Build, Flash & Workflows

## Design

`flash` is the unifying command. It accepts an artifact path — either resolved automatically or provided explicitly.

```
flash totem-left                        # resolves latest artifact from GitHub, flashes
flash ./build/local/totem-left.uf2      # explicit path, flashes directly
flash $(artifact totem-left)            # artifact prints resolved path, flash uses it
```

---

## Commands

### `flash <artifact-name | path>`

Flashes firmware to hardware. The artifact path is the core input.

- If given an **artifact name** (`totem-left`): resolves the path automatically (see `artifact`)
- If given a **file path**: uses it directly, no resolution

```
flash totem-left
flash totem-left --side left
flash ./build/local/totem-left.uf2
```

### `artifact <artifact-name>`

Resolves and prints the local path to an artifact, or errors if unavailable.
Designed to be pipeable — `flash` calls this internally for the default case.

Resolution order:
1. `build/local/{artifact-name}.uf2` — from local docker build
2. `build/ci/{artifact-name}.uf2`    — previously downloaded from GitHub
3. GitHub Actions latest run          — downloads and caches to `build/ci/`

```
artifact totem-left                    # → /path/to/totem-left.uf2
artifact totem-left --run 12345678     # specific GitHub run
artifact totem-left --source local     # local build only, error if missing
artifact totem-left --source github    # GitHub only, skip local
```

### `build <artifact-name>`

Compiles firmware locally via Docker, outputs to `build/local/`.
Uses `scripts/docker/docker-compose.yml` under the hood.

```
build totem-left
build totem-left corne-left            # multiple targets
build --all                            # all targets from build.yaml
```

### `workflow status`

Shows GitHub Actions CI build status for all artifacts in `build.yaml`.

```
workflow status
```

---

## Artifact Names

Artifact names come directly from `build.yaml` (`artifact-name` field) and are the canonical
identifier across all commands:

```yaml
- board: xiao_ble//zmk
  shield: totem_left
  artifact-name: totem-left           # ← this
```

No separate keyboard config needed — `build.yaml` is the single source of truth.

---

## Config

`apps/cli/config/local.json` holds infrastructure config only — no keyboard definitions:

```json
{
  "github": {
    "owner": "3dyuval",
    "repo": "keyboards-firmware"
  }
}
```

Keyboard definitions (board, shield, artifact name) live exclusively in `build.yaml`.

---

## Distribution

The CLI is distributed as a single compiled binary via `bun build --compile`.
All subcommands (`flash`, `artifact`, `build`, `workflow`) are part of the same binary.

```
bun build --compile apps/cli/index.tsx --outfile keyb
./keyb flash totem-left
./keyb artifact totem-left
./keyb build totem-left
./keyb workflow status
```
