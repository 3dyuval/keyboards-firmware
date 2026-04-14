import { existsSync } from "fs";
import { extname } from "path";
import type { Hook } from "../app.ts";
import { getKeyboards } from "../../lib/keyboard-hooks.ts";

/**
 * Detect format from file extension or content.
 */
function detectFormat(path?: string, content?: string, explicitFormat?: "zmk" | "qmk"): "zmk" | "qmk" {
  if (explicitFormat) return explicitFormat;
  
  // Detect from file extension
  if (path) {
    const ext = extname(path).toLowerCase();
    if (ext === ".keymap" || ext === ".yaml" || ext === ".yml") return "zmk";
    if (ext === ".c" || ext === ".json") return "qmk";
  }
  
  // Detect from content heuristics
  if (content) {
    const trimmed = content.trim();
    // ZMK: starts with #include or / {
    if (trimmed.startsWith("#include") || trimmed.startsWith("/ {")) return "zmk";
    // QMK JSON: starts with { and contains layers array
    if (trimmed.startsWith("{") && trimmed.includes("\"layers\"")) return "qmk";
  }
  
  // Default to zmk
  return "zmk";
}

/**
 * Normalize input into unified payload format.
 * 
 * Accepts:
 * - path: file path to keymap
 * - config: keyboard config name → resolves to file path
 * - json: inline keymap content (JSON or YAML string)
 * 
 * Produces:
 * - { type: "file", format: "zmk"|"qmk", src: string } for file paths
 * - { type: "json", format: "zmk"|"qmk", src: string } for inline content
 */
export async function normalizePayload(context: Hook) {
  const { path, config, json, format } = context.data || {};
  const root = context.app.get("root");

  // Case 1: inline content
  if (json !== undefined) {
    const fmt = detectFormat(undefined, json, format);
    context.params.payload = { type: "json" as const, format: fmt, src: json };
    return;
  }

  // Case 2: explicit file path
  if (path !== undefined) {
    let filePath = path;
    if (!path.startsWith("/") && !path.startsWith("./")) {
      filePath = `${root}/${path}`;
    }
    
    if (!existsSync(filePath)) {
      throw new Error(`keymap not found: ${filePath}`);
    }
    
    const fmt = detectFormat(filePath, undefined, format);
    context.params.payload = { type: "file" as const, format: fmt, src: filePath };
    return;
  }

  // Case 3: config name → resolve to file path
  if (config !== undefined) {
    const keyboards = await getKeyboards(context.app);
    const keyboardConfig = keyboards[config];

    if (!keyboardConfig) {
      throw new Error(`unknown keyboard config: ${config}`);
    }

    let filePath: string;
    if (keyboardConfig.keymap) {
      filePath = `${root}/${keyboardConfig.keymap}`;
    } else {
      filePath = `${root}/config/${config}.keymap`;
    }

    if (!existsSync(filePath)) {
      throw new Error(`keymap not found: ${filePath}`);
    }

    const fmt = keyboardConfig.type || detectFormat(filePath);
    context.params.payload = { type: "file" as const, format: fmt, src: filePath };
    context.params.keyboardConfig = keyboardConfig;
    return;
  }

  throw new Error("either --path, --config, or --json is required");
}

export default {
  before: {
    create: [normalizePayload],
  },
};
