# Firmware Build

How firmware is produced and retrieved. Building is **not baked into the CLI** — it
sits behind a swappable [artifact-provider interface](./build-providers.md). The CLI
only ever asks *"get me artifact X"*; it never knows how X was built.

> Supersedes the earlier "local build" proposal (host-tool detection +
> `--local`/`--no-local` flags + auto-fallback). That approach was **rejected** — see
> [Decisions](#decisions).

## Model

Every way of producing firmware is an **artifact provider**: given an artifact name
from `build.yaml`, it lands `<artifact>.{uf2,bin,hex}` in `.cache/ci/`, keyed by that
name. The resolver is origin-blind — it cannot tell whether the bytes came from CI or
a local container.

```
┌───────────────┐  provider.fetch(artifact)   ┌─────────────────────┐
│ firmware svc  │ ──────────────────────────▶ │ ArtifactProvider    │
│ (origin-blind)│                             │  github | gitlab |  │
│               │ ◀── .cache/ci/<art>.uf2 ─── │  container          │
└───────────────┘                             └─────────────────────┘
        ▲                                                │
        └──── R(artifactProvider) = local.json ?? default.json (DI)
```

The active provider is chosen by config, not code. Switching a machine to local
container builds, or adding GitLab, is a config value + (for new origins) one provider
module — **no change to the firmware service.** See
[build-providers.md](./build-providers.md) for the interface and migration plan.

## Containerized build (the local provider)

The **only** local build backend is the container. There is no host-`west`/`qmk`
detection mode.

- Builds **one** target by name (from `build.yaml` `artifact-name`), not the whole
  matrix.
- Output is **fetched** out of the container (`docker cp`) into `.cache/ci/` — the
  same dir and naming GitHub downloads use. There is **no** `:/build` bind mount and
  **no** `.cache/local/` tier.
- The toolchain lives in the build image (e.g. `zmkfirmware/zmk-build-arm`,
  `jonz94/qmk_firmware`); the west workspace persists in a named volume across builds.
- If `docker` is not available while the container provider is active → **hard
  error** (`install docker or use --source github`). No silent fallback.

## Selecting a provider

```jsonc
// default.json  — fresh-checkout default
{ "artifactProvider": "github" }

// local.json    — per-machine override (e.g. offline dev)
{ "artifactProvider": "container" }
```

Per-invocation override:

```sh
keyb flash klor-nice_nano left --source container
keyb flash klor-nice_nano left --source github
```

`--source <name>` must name a registered, available provider; otherwise it hard-errors.

## Decisions

| # | Decision |
|---|----------|
| D1 | Containerized build is the **only** local backend — no host-tool detection / on-off flag. |
| D2 | Container artifacts are **fetched into `.cache/ci/`**, same dir + naming as GitHub. |
| D3 | `.cache/local/` tier and the `:/build` mount are **removed**. |
| D4 | Active provider selected by **config** (`artifactProvider`), `--source` overrides per call. |
| D5 | Unavailable active provider → **hard error**, never silent fallback. |
| D6 | Container builds **one artifact by name**, not the matrix. |

## Status

- [x] `build.yaml`: `nice_nano_v2` + klor shield split entries added (alongside Feather).
- [ ] Extract `ArtifactProvider` interface + config-driven registry (DI).
- [ ] Wrap `gh.downloadArtifact()` as `GitHubProvider`.
- [ ] `ContainerProvider`: single-target build, `docker cp` to `.cache/ci/`, docker-presence check.
- [ ] Remove `.cache/local/` tier + `:/build` mount from `resolveArtifactPath` and compose.
- [ ] Reduce/replace `scripts/docker/build.sh` matrix orchestration with single-target entry.

## Related

- [build-providers.md](./build-providers.md) — provider interface, two framings, migration.
- [flash.md](./flash.md) — artifact path resolution and flash flow.
- [config.md](./config.md) — config resolution model (`R(x) = …`).
