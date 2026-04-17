import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, basename, isAbsolute } from "path";
import type { Hook } from "../app.ts";
import { getKeyboards } from "../../lib/keyboard-hooks.ts";
import { github } from "./gh.ts";

export async function resolveArtifactPath(context: Hook) {
  const artifact: string = context.data?.artifact ?? context.params?.artifact;
  const source: string = context.data?.source ?? context.params?.source ?? "auto";
  const run: string | undefined = context.data?.run ?? context.params?.run;

  const root = context.app.get("root") as string;
  const buildDir = context.app.get("buildDir") as string;

  // Explicit file path
  if (isAbsolute(artifact) || artifact.startsWith("./") || artifact.endsWith(".uf2") || artifact.endsWith(".bin")) {
    if (!existsSync(artifact)) throw new Error(`path not found: ${artifact}`);
    context.params.artifactPath = artifact;
    context.params.artifactName = basename(artifact).replace(/\.(uf2|bin)$/, "");
    return;
  }

  // Artifact name — validate against build.yaml
  const keyboards = await getKeyboards(context.app);
  const base = artifact.replace(/-(?:left|right)$/, "");
  if (!keyboards[base]) throw new Error(`unknown artifact "${artifact}" — not in build.yaml`);

  context.params.artifactName = artifact;
  context.params.keyboardConfig = keyboards[base];

  const localPath = join(buildDir, "local", `${artifact}.uf2`);
  const ciPath = join(buildDir, "ci", `${artifact}.uf2`);
  context.params.cacheDir = join(buildDir, "ci");

  if (source === "local") {
    if (!existsSync(localPath)) throw new Error(`artifact "${artifact}" not found in build/zmk/`);
    context.params.artifactPath = localPath;
    return;
  }

  if (source === "github" || run) {
    context.params.needsGitHub = true;
    if (run) context.params.runId = run;
    return;
  }

  // Auto: local → ci-cache → github
  if (existsSync(localPath)) { context.params.artifactPath = localPath; return; }
  if (existsSync(ciPath))    { context.params.artifactPath = ciPath;    return; }

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
  const ciPath = join(cacheDir, `${artifactName}.uf2`);
  const stampFile = join(cacheDir, `${artifactName}.run-id`);
  if (
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf-8").trim() === String(runId) &&
    existsSync(ciPath)
  ) {
    context.params.artifactPath = ciPath;
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
