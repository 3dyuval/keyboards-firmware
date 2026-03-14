import { z } from "zod";
import { keyboardField } from "../../lib/types.ts";

export const DrawSchema = z.object({
  keyboard: keyboardField,
});

export type DrawCreate = z.infer<typeof DrawSchema>;
