import { z } from "zod";
import { keyboardField } from "../../lib/types.ts";

export const DrawSchema = z.object({
  path: z.string().optional().meta({ description: "Path to keymap file" }),
  config: z.string().optional().meta({ description: "Keyboard config name" }),
  json: z.string().optional().meta({ description: "Inline keymap content (JSON or YAML)" }),
  format: z.enum(["zmk", "qmk"]).optional().meta({ description: "Keymap format (auto-detected from path if not specified)" }),
}).refine((data) => data.path || data.config || data.json, {
  message: "either path, config, or json is required",
});

export type DrawCreate = z.infer<typeof DrawSchema>;
