# Artifact Providers — Build/Fetch Backend Abstraction

> Status: **design draft**. Decisions captured; two interface framings sketched (§4)
> for comparison before implementation.

## 1. Problem

The CLI currently has two competing firmware-build front doors:

1. **GitHub Actions** — the CLI dispatches/reads a workflow, then downloads the
   artifact into `.cache/ci/` via `gh.downloadArtifact()`. Origin-blind: the
   resolver just looks for `<artifact>.uf2` in the cache.
2. **`scripts/docker/`** — a separate, hand-run path (`build.sh`) that compiles the
   **entire `build.yaml` matrix** inside a container and dumps every artifact into
   `.cache/local/` via a `:/build` bind mount.

Path 2 is idiosyncratic: it bypasses the service layer, has its own output
convention, can't build a single target, and pollutes the working tree with "a ton
of artifacts." It is build logic **baked beside** the CLI rather than behind an
interface.

## 2. Goal

The build backend must be **isolated from the CLI behind an interface**. The CLI is
one consumer; it knows only *"get me artifact X"* — never *how* X is produced or
retrieved. GitHub, GitLab, and a local container are all the **same kind of thing**:
a swappable **artifact provider**, selected by config (DI), not by a hardcoded
`if/else` chain.

Litmus test for "is the abstraction right": **adding a GitLab provider, or switching
a machine to local-container builds, requires zero changes to `firmware.service.ts`
— only a config value and a new provider module.**

## 3. Decisions (locked)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Containerized build is the **only** local build backend. No host-tools (`west`/`qmk`) detection mode. | Kills the on/off ambiguity from `docs/local.md`. One way to build locally. |
| D2 | Container artifacts are **fetched into `.cache/ci/`**, same dir + same naming as GitHub downloads. | Origin-blind resolver; "fetched the same way as GH." |
| D3 | `.cache/local/` tier and the `:/build` mount are **removed entirely**. | One cache, no parallel output convention. |
| D4 | The active provider is selected by **config** (`artifactProvider`), resolved via the standard `R(x) = local.json ?? default.json` chain. `--source <name>` overrides per-invocation. | This is the DI. GitLab/local/other drop in without service changes. |
| D5 | When the active provider is unavailable (e.g. container provider, no docker) → **hard error** with actionable message. Never silently fall through. | Matches repo's fail-fast philosophy; no surprise stale/remote artifacts. |
| D6 | Container builds **one artifact by name** (from `build.yaml` `artifact-name`), not the matrix. | Required for `fetch(artifact)` to mean anything. |

## 4. Interface — two framings to compare

Both share: providers land `<artifact>.{uf2,bin,hex}` in a destination dir
(`.cache/ci/`), keyed by the `build.yaml` artifact name; selection is config-driven;
unavailable provider → throw.

### Framing A — One concept: `provider.fetch()`

The CLI only ever says "fetch artifact X." Whether that means *download a pre-built
file* (GitHub/GitLab) or *build-then-hand-over* (container) is **hidden inside the
provider**. Building is an implementation detail of `ContainerProvider`.

```ts
interface ArtifactProvider {
  readonly name: string;                 // "github" | "gitlab" | "container"
  available(app): boolean;               // token present? docker present?
  /** Land <artifact>.{uf2,bin,hex} in `dest`, return the path. Throw if unavailable. */
  fetch(artifact: string, dest: string, opts?: FetchOpts): AsyncGenerator<ServiceEvent, string>;
}
```

| Provider | `available()` | `fetch()` does |
|----------|---------------|----------------|
| `GitHubProvider` | token + owner/repo set | wraps today's `gh.downloadArtifact()` |
| `GitLabProvider` *(future)* | GL token set | GitLab CI artifact API → same dest |
| `ContainerProvider` | `docker` on PATH | `docker run` build image for one target → `docker cp` out to dest |

Resolution (replaces the hardcoded chain in `resolveArtifactPath`):

```
cache hit in .cache/ci/?  → use it
else                      → provider = R(artifactProvider); provider.fetch(artifact, .cache/ci/)
provider unavailable      → throw
```

**Pros:** fewest concepts; CLI has one verb; literally "fetched the same way as GH";
smallest diff to the service layer.
**Cons:** "fetch" is a slight euphemism for the container (it builds). A future
"build but don't deploy" command has no first-class verb — it'd be `fetch` with the
container provider.

### Framing B — Two concepts: `Builder` + `Fetcher`

Building and fetching are **distinct roles**. A `Builder` produces artifacts; a
`Fetcher` retrieves already-built ones. Container is a `Builder`; GitHub/GitLab are
`Fetcher`s.

```ts
interface Fetcher {
  readonly name: string;
  available(app): boolean;
  fetch(artifact, dest): AsyncGenerator<ServiceEvent, string>;
}
interface Builder {
  readonly name: string;
  available(app): boolean;
  build(artifact, dest): AsyncGenerator<ServiceEvent, string>;
}
```

The CLI now must know **which kind** it's invoking. Config would carry both, e.g.
`{ "builder": "container", "fetcher": "github" }`, and a `build` command targets the
Builder while `flash`/`get` target the Fetcher (or the Builder, if "build locally"
is set).

**Pros:** precise vocabulary; a standalone `keyb build <artifact>` command maps
cleanly to `Builder.build()`; "build vs retrieve" is explicit in status/logs.
**Cons:** reintroduces coupling — the CLI branches on builder-vs-fetcher, which is
the `if/else` we set out to remove (D4). GitHub *also* builds (in CI); calling it a
pure "Fetcher" is its own euphemism. Two registries, two config keys, more surface.

### Recommendation (for discussion, not yet locked)

**Framing A.** It's the minimal expression of D1–D6: one verb, one registry, one
config key, origin-blind cache. The "container secretly builds" wrinkle is cosmetic
— from the CLI's seat, GitHub *also* secretly builds (in CI); we already treat that
as fetch. If a first-class `build` command is later wanted, it can be sugar over
`fetch` with `--source container` rather than a second interface. Framing B's extra
precision buys a distinction the CLI explicitly does **not** want to make (D2/D4).

## 5. Config shape (Framing A)

```jsonc
// default.json
{
  "artifactProvider": "github"        // default origin on a fresh checkout
}
// local.json  (per-machine override — e.g. offline dev box)
{
  "artifactProvider": "container"     // CLI now builds locally, no code change
}
```

Per-invocation override: `keyb flash klor-nice_nano left --source container`.
`--source <name>` must name a registered, available provider, else hard error (D5).

## 6. Migration

1. Extract `ArtifactProvider` interface + a small registry (DI: `app.get("artifactProvider")` selects).
2. Wrap existing `gh.downloadArtifact()` as `GitHubProvider.fetch()` — behavior unchanged.
3. Add `ContainerProvider.fetch()`:
   - refactor `scripts/docker` to build **one** target by name (D6),
   - remove `:/build` mount; `docker cp` the single artifact into `.cache/ci/` (D2),
   - `available()` checks `docker` on PATH; missing → throw (D5).
4. In `resolveArtifactPath`: delete the `.cache/local/` tier (D3); replace the
   `source === "github"` / auto branch with `provider = resolve(); provider.fetch(...)`.
5. Delete `build.sh` matrix-build orchestration (or reduce it to a thin
   single-target entry the provider shells out to).
6. Update `docs/config.md`, `docs/flash.md` to describe provider selection instead
   of the local/ci/github hardcoded precedence.

## 7. Open questions

- **OQ1** — Framing A vs B (recommendation: A). *Decide before implementation.*
- **OQ2** — Does `ContainerProvider` cache the toolchain image/volume across builds
  (the current `zmk-west` named volume) to avoid re-`west update` each time? (Likely
  yes — keep the named volume, just drop the output bind mount.)
- **OQ3** — Should a cache hit in `.cache/ci/` be keyed by anything beyond artifact
  name (e.g. a content/run stamp) so a stale container artifact is re-built when
  `build.yaml`/keymap changes? Today GitHub uses a `.run-id` stamp; container has no
  equivalent run id. (Possible: hash of relevant source files.)
