import { existsSync } from "fs";
import { join } from "path";
import type { Hook } from "../app.ts";
import {
  resolveKeyboard,
  validateKeyboard,
} from "../../lib/keyboard-hooks.ts";

/**
 * Resolve the keymap file path from keyboard config.
 * Uses explicit config.keymap or ZMK convention (config/{kb}.keymap).
 */
export function resolveKeymap(context: Hook) {
  const { keyboard, keyboardConfig } = context.params as any;
  const root = context.app.get("root");

  const keymapPath = keyboardConfig.keymap
    ? join(root, keyboardConfig.keymap)
    : join(root, "config", `${keyboard}.keymap`);

  if (!existsSync(keymapPath)) {
    throw new Error(`keymap not found: ${keymapPath}`);
  }

  context.params.keyboardConfig = { ...keyboardConfig, keymapPath };
}

export default {
  before: {
    create: [resolveKeyboard, validateKeyboard, resolveKeymap],
  },
};
