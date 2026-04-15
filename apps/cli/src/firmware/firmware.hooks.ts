import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Hook } from "../app.ts";
import {
  resolveKeyboard,
  validateKeyboard,
  getKeyboards,
} from "../../lib/keyboard-hooks.ts";
import { github } from "./gh.ts";

export { validateKeyboard };

export type FirmwareSource =
  | { kind: "remote"; runId: string }
  | { kind: "local" };

export async function resolveConfig(context: Hook) {
  const keyboards = await getKeyboards(context.app);
  const cacheDir = context.app.get("cacheDir");

  if (context.method === "find") {
    context.params.keyboards = keyboards;
    context.params.cacheDir = cacheDir;
    return;
  }

  await resolveKeyboard(context);
  const kb = (context.params as any).keyboard;
  context.params.cacheDir = join(cacheDir, kb);
}

export async function resolveSource(context: Hook) {
  const { keyboardConfig, keyboard } = context.params as any;
  const { local, run } = context.data ?? {};

  if (local) {
    if (!keyboardConfig.local) {
      throw new Error(
        `local build not configured for "${keyboard}" — add a local: block to config`,
      );
    }
    context.params.source = { kind: "local" } satisfies FirmwareSource;
    return;
  }

  // Normalize new remote: block and legacy top-level workflow/artifact
  const remoteConfig = keyboardConfig.remote ??
    (keyboardConfig.workflow
      ? { workflow: keyboardConfig.workflow, artifact: keyboardConfig.artifact }
      : null);

  if (!remoteConfig) {
    throw new Error(`no remote or local source configured for "${keyboard}"`);
  }

  const gh = github(context.app);
  const runId = run ?? (await gh.waitAndResolve(remoteConfig.workflow));
  context.params.source = { kind: "remote", runId } satisfies FirmwareSource;
}

export async function checkCache(context: Hook) {
  const { source, cacheDir } = context.params as any;
  if (source?.kind !== "remote") return;

  const stampFile = join(cacheDir, ".run-id");
  if (
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf-8").trim() === source.runId
  ) {
    context.params.cached = true;
  }
}

export function writeCache(context: Hook) {
  const { source, cacheDir, cached } = context.params as any;
  if (source?.kind !== "remote" || cached || !cacheDir || !source.runId) return;
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(join(cacheDir, ".run-id"), source.runId);
}

export default {
  before: {
    all: [resolveConfig],
    find: [],
    get: [validateKeyboard],
    create: [validateKeyboard, resolveSource, checkCache],
    patch: [validateKeyboard, resolveSource, checkCache],
  },
  after: {
    create: [writeCache],
    patch: [writeCache],
  },
};
