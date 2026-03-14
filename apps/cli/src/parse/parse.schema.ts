import { z } from "zod";

export const ParseSchema = z.object({
  file: z.string().meta({ description: "Path to keymap file" }),
  keyboard: z.string().optional().meta({ description: "Keyboard name" }),
  keymap: z.string().optional().meta({ description: "Keymap name" }),
});

export type ParseCreate = z.infer<typeof ParseSchema>;
