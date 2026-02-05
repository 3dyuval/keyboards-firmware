import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve } from "path";
import { load } from "js-yaml";

export type PhysKey = { x: number; y: number; w: number; h: number; r: number };
export type KeyEntry = string | { t?: string; h?: string; s?: string; type?: string };
export type KeymapData = { layers: Record<string, KeyEntry[]>; layout: any };
export type ResolvedKeyboard = { name: string; physKeys: PhysKey[]; keymap: KeymapData };

// packages/input/ is ../../ from src/config/
const INPUT_DIR = resolve(import.meta.dir, "..", "..");
const ROOT = resolve(INPUT_DIR, "..", "..");

export function resolveAll(opts?: { yamlDir?: string; layoutsFile?: string }): ResolvedKeyboard[] {
  const yamlDir = opts?.yamlDir ?? resolve(ROOT, "keymap-drawer");
  const layoutsFile = opts?.layoutsFile ?? resolve(INPUT_DIR, "keyboard-layouts.json");

  if (!existsSync(layoutsFile)) throw new Error(`Layouts not found: ${layoutsFile}`);
  if (!existsSync(yamlDir)) throw new Error(`YAML dir not found: ${yamlDir}`);

  const layouts: Record<string, PhysKey[]> = JSON.parse(readFileSync(layoutsFile, "utf-8"));
  const keyboards: ResolvedKeyboard[] = [];

  for (const file of readdirSync(yamlDir).filter((f) => f.endsWith(".yaml"))) {
    const name = file.replace(".yaml", "");
    if (!layouts[name]) continue;
    const keymap = load(readFileSync(resolve(yamlDir, file), "utf-8")) as KeymapData;
    keyboards.push({ name, physKeys: layouts[name], keymap });
  }

  return keyboards;
}

export function resolveOne(name: string, opts?: { yamlDir?: string; layoutsFile?: string }): ResolvedKeyboard {
  const yamlDir = opts?.yamlDir ?? resolve(ROOT, "keymap-drawer");
  const layoutsFile = opts?.layoutsFile ?? resolve(INPUT_DIR, "keyboard-layouts.json");

  const layouts: Record<string, PhysKey[]> = JSON.parse(readFileSync(layoutsFile, "utf-8"));
  if (!layouts[name]) throw new Error(`No physical layout for: ${name}`);

  const yamlPath = resolve(yamlDir, `${name}.yaml`);
  if (!existsSync(yamlPath)) throw new Error(`No keymap YAML for: ${name}`);

  const keymap = load(readFileSync(yamlPath, "utf-8")) as KeymapData;
  return { name, physKeys: layouts[name], keymap };
}
