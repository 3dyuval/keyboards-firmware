import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { Hook } from "../app.ts";
import {
  resolveKeyboard,
  validateKeyboard,
} from "../../lib/keyboard-hooks.ts";
import { github } from "./gh.ts";

export { validateKeyboard };

export function resolveConfig(context: Hook) {
  const keyboards = context.app.get("keyboards");
  const cacheDir = context.app.get("cacheDir");

  context.params.cacheDir = cacheDir;

  if (context.method === "find") {
    context.params.workflows = [
      ...new Set(Object.values(keyboards).map((k) => k.workflow)),
    ];
    context.params.keyboards = keyboards;
    return;
  }

  resolveKeyboard(context);
}

export async function resolveRunId(context: Hook) {
  const { keyboardConfig } = context.params as any;
  const gh = github(context.app);
  const runId = await gh.waitAndResolve(keyboardConfig.workflow);
  context.params.runId = runId;
}

export async function checkCache(context: Hook) {
  const { runId, cacheDir } = context.params as any;
  const stampFile = join(cacheDir, ".run-id");
  if (
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf-8").trim() === runId
  ) {
    context.params._cached = true;
  }
}

export function writeCache(context: Hook) {
  const { cacheDir, runId, _cached } = context.params as any;
  if (!_cached && cacheDir && runId) {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, ".run-id"), runId);
  }
}

export default {
  before: {
    all: [resolveConfig],
    find: [],
    get: [validateKeyboard],
    create: [validateKeyboard, resolveRunId, checkCache],
    patch: [validateKeyboard, resolveRunId, checkCache],
  },
  after: {
    create: [writeCache],
  },
};
