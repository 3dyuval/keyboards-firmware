import type { HookContext } from "@feathersjs/feathers";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import * as gh from "./gh.ts";

interface KeyboardConfig {
  workflow: string;
  artifact: string;
  type: "zmk" | "qmk";
}

export function checkGithubAuth(context: HookContext) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.GITHUB_AUTH_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN, GH_TOKEN, or GITHUB_AUTH_TOKEN. Set it in apps/cli/.env");
  }
}

export function resolveConfig(context: HookContext) {
  const github = context.app.get("github") as { owner: string; repo: string };
  const keyboards = context.app.get("keyboards") as Record<string, KeyboardConfig>;
  const cacheDir = context.app.get("cacheDir") as string;

  context.params.github = github;
  context.params.cacheDir = cacheDir;

  if (context.method === "find") {
    context.params.workflows = [...new Set(Object.values(keyboards).map((k) => k.workflow))];
    return;
  }

  const kb = String(context.id ?? context.data?.keyboard);
  context.params.keyboard = kb;
  context.params.keyboardConfig = keyboards[kb];
}

export function validateKeyboard(context: HookContext) {
  if (!context.params.keyboardConfig) {
    throw new Error(`unknown keyboard "${context.params.keyboard}" — not in config`);
  }
}

export async function checkCache(context: HookContext) {
  const { github: { owner, repo }, keyboardConfig, keyboard, cacheDir } = context.params as any;
  const { workflow, artifact } = keyboardConfig;

  const runId = await gh.waitAndResolve(owner, repo, workflow);
  context.params.runId = runId;

  const stampFile = join(cacheDir, ".run-id");
  if (existsSync(stampFile) && readFileSync(stampFile, "utf-8").trim() === runId) {
    context.result = { keyboard, runId, workflow, artifact, cached: true, cacheDir };
  }
}

export function writeCache(context: HookContext) {
  if (context.result?.cached === false) {
    const { cacheDir, runId } = context.result;
    writeFileSync(join(cacheDir, ".run-id"), runId);
  }
}

export const firmwareHooks = {
  before: {
    all: [checkGithubAuth],
    find: [resolveConfig],
    get: [resolveConfig, validateKeyboard, checkCache],
    create: [resolveConfig, validateKeyboard],
  },
  after: {
    get: [writeCache],
  },
};
