import { z } from "zod";

export const KeyboardSchema = z.object({
  workflow: z.string(),
  artifact: z.string(),
  type: z.enum(["zmk", "qmk"]),
  keymap: z.string().optional(),
});

export type Keyboard = z.infer<typeof KeyboardSchema>;
