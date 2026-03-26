import { readFileSync } from "fs";
import { join } from "path";
import { YAML } from "bun";
import type { Hook, App } from "../src/app.ts";
import { github } from "../src/firmware/gh.ts";

/**
 * Returns the keyboards map from config, or auto-discovers from GitHub
 * if the config map is empty. Result is cached on the app instance.
 */
export async function getKeyboards(app: App): Promise<Record<string, any>> {
  const keyboards = app.get("keyboards") as Record<string, any>;
  if (keyboards && Object.keys(keyboards).length > 0) return keyboards;

  const cached = app.get("_discoveredKeyboards") as
    | Record<string, any>
    | undefined;
  if (cached) return cached;

  const root = app.get("root") as string;
  try {
    const raw = readFileSync(join(root, "build.yaml"), "utf-8");
    const parsed = YAML.parse(raw) as { include: { "artifact-name": string }[] };
    const fromBuild: Record<string, any> = {};
    for (const entry of parsed.include ?? []) {
      const name = entry["artifact-name"];
      if (!name || name.startsWith("settings-reset")) continue;
      const base = name.replace(/-(?:left|right)$/, "");
      if (!fromBuild[base])
        fromBuild[base] = { workflow: "build-zmk.yml", artifact: base, type: "zmk" };
    }
    if (Object.keys(fromBuild).length > 0) {
      app.set("_discoveredKeyboards", fromBuild);
      return fromBuild;
    }
  } catch (e: any) {
    if (e?.code !== "ENOENT") console.warn("build.yaml parse failed:", e?.message);
    // fall through to GitHub
  }

  const discovered = await github(app).discoverKeyboards();
  app.set("_discoveredKeyboards", discovered);
  return discovered;
}

/**
 * Resolve keyboard name from various sources (params, route, id, data)
 * and look up its config from app keyboards map.
 * Sets: context.params.keyboard, context.params.keyboardConfig
 */
export async function resolveKeyboard(context: Hook) {
  const keyboards = await getKeyboards(context.app);

  const kb = String(
    context.params.keyboard ??
      context.params.route?.keyboardId ??
      context.id ??
      context.data?.keyboard,
  );
  context.params.keyboard = kb;
  context.params.keyboardConfig = keyboards[kb];
}

/**
 * Throw if keyboardConfig was not resolved (unknown keyboard name).
 */
export function validateKeyboard(context: Hook) {
  if (!context.params.keyboardConfig) {
    throw new Error(
      `unknown keyboard "${context.params.keyboard}" — not in config`,
    );
  }
}
