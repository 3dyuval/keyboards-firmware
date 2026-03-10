import type { HookContext } from "@feathersjs/feathers";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { github } from "./gh.ts";

const dataHome = Bun.env.XDG_DATA_HOME ?? join(Bun.env.HOME!, ".local/share");

interface KeyboardConfig {
  workflow: string;
  artifact: string;
  type: "zmk" | "qmk";
}

export function resolveConfig(context: HookContext) {
  const keyboards = context.app.get("keyboards") as Record<
    string,
    KeyboardConfig
  >;
  const cacheDir = join(dataHome, context.app.get("cacheDir") as string);

  context.params.cacheDir = cacheDir;

  if (context.method === "find") {
    context.params.workflows = [
      ...new Set(Object.values(keyboards).map((k) => k.workflow)),
    ];
    context.params.keyboards = keyboards;
    return;
  }

  const kb = String(
    context.params.keyboard ??
      context.params.route?.keyboardId ??
      context.id ??
      context.data?.keyboard,
  );
  context.params.keyboard = kb;
  context.params.keyboardConfig = keyboards[kb];
}

export function validateKeyboard(context: HookContext) {
  if (!context.params.keyboardConfig) {
    throw new Error(
      `unknown keyboard "${context.params.keyboard}" — not in config`,
    );
  }
}

export async function resolveRunId(context: HookContext) {
  const { keyboardConfig } = context.params as any;
  const gh = github(context.app);
  const runId = await gh.waitAndResolve(keyboardConfig.workflow);
  context.params.runId = runId;
}

export async function checkCache(context: HookContext) {
  const { runId, cacheDir } = context.params as any;
  const stampFile = join(cacheDir, ".run-id");
  if (
    existsSync(stampFile) &&
    readFileSync(stampFile, "utf-8").trim() === runId
  ) {
    context.params._cached = true;
  }
}

export function writeCache(context: HookContext) {
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
