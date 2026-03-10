import { z } from "zod";

export const FirmwareCreateSchema = z.object({
  keyboard: z
    .string()
    .meta({ description: "Keyboard name" }),
});

export const FirmwareFlashSchema = z.object({
  keyboard: z
    .string()
    .meta({ description: "Keyboard name" }),
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
