import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, basename, isAbsolute } from "path";
import type { Hook } from "../app.ts";
import { getKeyboards } from "../../lib/keyboard-hooks.ts";
import { github } from "./gh.ts";

/** Find a firmware file by artifact name, checking .uf2/.bin/.hex extensions. */
function findFirmwareFile(dir: string, artifact: string): string | null {
  if (!existsSync(dir)) return null;
  // The build system writes new artifacts as numbered copies (name_1, name_2, …)
  // rather than overwriting, so the base-name file is the OLDEST build. Match all
  // files with the artifact prefix and return the most recently modified one, so
  // the latest build is always flashed. An exact name+ext match only wins if it
  // is also the newest.
  const suffixRe = /^(_\d+)?\.(uf2|bin|hex)$/;
  const entries = readdirSync(dir)
    .filter(f => f.startsWith(artifact) && suffixRe.test(f.slice(artifact.length)))
    .map(f => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return entries.length > 0 ? entries[0] : null;
}

export async function resolveArtifactPath(context: Hook) {
  const artifact: string = context.data?.artifact ?? context.params?.artifact;
  const source: string = context.data?.source ?? context.params?.source ?? "auto";
  const run: string | undefined = context.data?.run ?? context.params?.run;

  const root = context.app.get("root") as string;
  const buildDir = context.app.get("buildDir") as string;
  // Resolve buildDir relative to git root, not cwd
  const resolvedBuildDir = isAbsolute(buildDir) ? buildDir : join(root, buildDir);

  const keyboards = await getKeyboards(context.app);

  // Resolve and attach flash config for a given keyboard base name.
  const applyFlashConfig = (base: string) => {
    context.params.keyboard = base;
    context.params.keyboardConfig = keyboards[base];

    const kbFlash = keyboards[base].flash;
    if (!kbFlash) {
      throw new Error(`no flash configuration for keyboard "${base}" — add to local.json`);
    }

    const flashPresetName = kbFlash.preset;
    const presets = context.app.get("flashPresets");
    if (!flashPresetName || !presets?.[flashPresetName]) {
      throw new Error(`unknown flash preset "${flashPresetName}" for keyboard "${base}" — defined in config/default.ts`);
    }

    const basePreset = presets[flashPresetName];
    context.params.flashConfig = { ...basePreset, ...kbFlash, preset: flashPresetName };
  };

  // Explicit file path — infer the keyboard from the file's basename so the
  // flash config (method/preset) is still resolved, then flash the file as-is.
  if (isAbsolute(artifact) || artifact.startsWith("./") || artifact.endsWith(".uf2") || artifact.endsWith(".bin")) {
    if (!existsSync(artifact)) throw new Error(`path not found: ${artifact}`);
    const fileBase = basename(artifact).replace(/\.(uf2|bin|hex)$/, "");
    // Match against each keyboard's configured artifact name (prefix match).
    const match = Object.keys(keyboards).find(k => {
      const cfgArtifact = keyboards[k].artifact ?? k;
      return fileBase === cfgArtifact || fileBase.startsWith(cfgArtifact);
    });
    if (!match) {
      throw new Error(`could not infer keyboard for "${basename(artifact)}" — no configured artifact name matches; flash by keyboard name instead`);
    }
    applyFlashConfig(match);
    context.params.artifactPath = artifact;
    context.params.artifactName = fileBase;
    return;
  }

  // Artifact name — validate against keyboards map
  const base = artifact.replace(/-(?:left|right)$/, "");
  if (!keyboards[base]) throw new Error(`unknown artifact "${artifact}" — not in keyboards config`);

  applyFlashConfig(base);

  const cfgArtifact = keyboards[base].artifact;
  const useArtifact = cfgArtifact !== base ? cfgArtifact : artifact;
  context.params.artifactName = useArtifact;

  const localPath = findFirmwareFile(join(resolvedBuildDir, "local"), useArtifact);
  const ciPath = findFirmwareFile(join(resolvedBuildDir, "ci"), useArtifact);
  context.params.cacheDir = join(resolvedBuildDir, "ci");

  if (source === "local") {
    if (!localPath) throw new Error(`artifact "${useArtifact}" not found locally`);
    context.params.artifactPath = localPath;
    return;
  }

  if (source === "github" || run) {
    context.params.needsGitHub = true;
    if (run) context.params.runId = run;
    return;
  }

  // Auto: local → ci-cache → github
  if (localPath) { context.params.artifactPath = localPath; return; }
  if (ciPath)      { context.params.artifactPath = ciPath;    return; }

  context.params.needsGitHub = true;
}

export async function resolveRunId(context: Hook) {
  if (!context.params.needsGitHub) return;
  if (context.params.runId) return; // already set by --run flag
  const { keyboardConfig } = context.params as any;
  const gh = github(context.app);
  context.params.runId = await gh.waitAndResolve(keyboardConfig.workflow);
}

export async function checkCache(context: Hook) {
  if (!context.params.needsGitHub) return;
  const { runId, cacheDir, artifactName } = context.params as any;
  const stampFile = join(cacheDir, `${artifactName}.run-id`);
  // Check for any firmware file in cache dir matching the artifact name
  let cachedPath: string | null = null;
  if (existsSync(cacheDir)) {
    const entries = readdirSync(cacheDir).filter(f => f.startsWith(artifactName) && /\.(uf2|bin|hex)$/.test(f));
    if (entries.length > 0) cachedPath = join(cacheDir, entries[0]);
  }
  if (
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf-8").trim() === String(runId) &&
    cachedPath
  ) {
    context.params.artifactPath = cachedPath;
    context.params._cached = true;
  }
}

export function writeCache(context: Hook) {
  const { cacheDir, runId, artifactName, _cached } = context.params as any;
  if (!_cached && cacheDir && runId && artifactName) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, `${artifactName}.run-id`), String(runId));
  }
}

export async function resolveConfig(context: Hook) {
  if (context.method === "find") {
    const keyboards = await getKeyboards(context.app);
    context.params.workflows = [...new Set(Object.values(keyboards).map((k: any) => k.workflow))];
    context.params.keyboards = keyboards;
    context.params.cacheDir = context.app.get("cacheDir");
  }
}

export default {
  before: {
    all: [resolveConfig],
    find: [],
    get: [],
    create: [resolveArtifactPath, resolveRunId, checkCache],
    patch:  [resolveArtifactPath, resolveRunId, checkCache],
  },
  after: {
    create: [writeCache],
    patch:  [writeCache],
  },
};
