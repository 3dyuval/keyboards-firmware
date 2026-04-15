import { z } from "zod";

export const RemoteConfig = z.object({
  workflow: z.string(),
  artifact: z.string(),
});

export const LocalBuildConfig = z.object({
  kb: z.string().optional(),     // QMK: keyboard path (e.g. "keebio/iris_lm/k1")
  km: z.string().optional(),     // QMK: keymap name
  board: z.string().optional(),  // ZMK: board (e.g. "xiao_ble")
  shield: z.string().optional(), // ZMK: shield name (defaults to keyboard name)
});

export const KeyboardSchema = z.object({
  type: z.enum(["zmk", "qmk"]),
  keymap: z.string().optional(),
  remote: RemoteConfig.optional(),
  local: LocalBuildConfig.optional(),
  // Legacy top-level fields — kept for auto-discovered keyboards
  workflow: z.string().optional(),
  artifact: z.string().optional(),
});

export type Keyboard = z.infer<typeof KeyboardSchema>;
export type RemoteConfig = z.infer<typeof RemoteConfig>;
export type LocalBuildConfig = z.infer<typeof LocalBuildConfig>;
