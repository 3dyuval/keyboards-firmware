import { z } from "zod";
import { keyboardField } from "../../lib/types.ts";

export const FirmwareCreateSchema = z.object({
  keyboard: keyboardField,
});

export const FirmwareFlashSchema = z.object({
  keyboard: keyboardField,
  side: z
    .enum(["left", "right"])
    .optional()
    .meta({ description: "Side to flash" }),
  reset: z
    .boolean()
    .default(false)
    .meta({ alias: "r", description: "Reset before flash" }),
  yes: z
    .boolean()
    .default(false)
    .meta({ alias: "y", description: "Skip confirmation" }),
});

export type FirmwareCreate = z.infer<typeof FirmwareCreateSchema>;
export type FirmwareFlash = z.infer<typeof FirmwareFlashSchema>;
