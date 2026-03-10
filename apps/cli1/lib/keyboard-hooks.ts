import type { Hook } from "../src/app.ts";

/**
 * Resolve keyboard name from various sources (params, route, id, data)
 * and look up its config from app keyboards map.
 * Sets: context.params.keyboard, context.params.keyboardConfig
 */
export function resolveKeyboard(context: Hook) {
  const keyboards = context.app.get("keyboards");

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
