import type { HookContext } from "@feathersjs/feathers";
import { join } from "path";

interface KeyboardConfig {
  workflow: string;
  artifact: string;
  type: "zmk" | "qmk";
  keymap?: string;
}

export function resolveKeyboardFromRoute(context: HookContext) {
  const keyboards = context.app.get("keyboards") as Record<string, KeyboardConfig>;
  const root = context.app.get("root") as string;

  const kb = context.params.route?.keyboardId as string | undefined;
  if (!kb) return;

  const config = keyboards[kb];
  if (!config) throw new Error(`unknown keyboard "${kb}" — not in config`);

  // Infer keymap path: explicit config or ZMK convention
  const keymapPath = config.keymap
    ? join(root, config.keymap)
    : join(root, "config", `${kb}.keymap`);

  context.params.keyboard = kb;
  context.params.keyboardConfig = { ...config, keymapPath };
}
