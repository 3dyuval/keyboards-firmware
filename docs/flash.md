# Flash Command — Config Resolution

## Inputs

| Input | Flag | Example |
|-------|------|---------|
| Artifact name | positional | `totem-left` |
| Explicit path | positional | `./build/zmk/totem-left.uf2` |
| Force source | `--source` | `local` \| `github` |
| Specific run | `--run` | `12345678` |

## Artifact Name Resolution

Artifact names come directly from `build.yaml` (`artifact-name` field).
The name is the canonical identifier — it maps to board, shield, and output file.

```
build.yaml  →  artifact-name: totem-left
                               └── used as: build/zmk/totem-left.uf2
                                            build/ci/totem-left.uf2
```

## Artifact Path Resolution Matrix

Columns are sources in precedence order (left = highest):

```
              P(path)   L(local)              C(ci-cache)           G(github)
              explicit  build/zmk/{name}.uf2  build/ci/{name}.uf2   API download
─────────────────────────────────────────────────────────────────────────────────
--source omit  yes       yes                   yes                    yes
--source local  yes       yes (forced)          —                      —
--source github yes       —                     —                      yes (forced)
--run <id>      —         —                     —                      yes (forced)
```

Compact rule:

```
R(artifactPath)
  = P                          if explicit path given
  = L                          if --source local (error if missing)
  = G(run=id)                  if --run <id>
  = G                          if --source github
  = L ?? C ?? G                default (auto)
```

## Config Sources

Infrastructure config (`apps/cli/config/`):

```
          local.json    default.ts
          ──────────    ──────────
github.owner  yes           —
github.repo   yes           —
cacheDir      —             yes  (→ .cache/firmware)
```

`cacheDir` controls where `build/ci/` artifacts land after a GitHub download.

## Error Cases

| Condition | Error |
|-----------|-------|
| Name not in `build.yaml` | `unknown artifact "x"` |
| `--source local` and file missing | `artifact "x" not found in build/zmk/` |
| `--source github` and no successful run | `no successful run found for "x"` |
| `--run <id>` and artifact not in run | `artifact "x" not found in run <id>` |
| None of L/C/G available | `artifact "x" could not be resolved` |

## Resolution Flow

```
flash totem-left
       │
       ▼
  name in build.yaml? ──no──▶ error
       │ yes
       ▼
  explicit path? ──yes──▶ use path directly
       │ no
       ▼
  --source local? ──yes──▶ build/zmk/{name}.uf2 or error
       │ no
       ▼
  --source github / --run? ──yes──▶ GitHub API → download → flash
       │ no
       ▼
  build/zmk/{name}.uf2 exists? ──yes──▶ flash
       │ no
       ▼
  build/ci/{name}.uf2 exists? ──yes──▶ flash
       │ no
       ▼
  GitHub API → download to build/ci/ → flash
```
