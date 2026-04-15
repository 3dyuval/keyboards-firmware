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
    .meta({ alias: "r", description: "Reset settings before flash" }),
  yes: z
    .boolean()
    .default(false)
    .meta({ alias: "y", description: "Skip confirmation prompt" }),
  local: z
    .boolean()
    .default(false)
    .meta({ alias: "L", description: "Build locally instead of downloading from CI" }),
  run: z
    .string()
    .optional()
    .meta({ alias: "R", description: "Use a specific GitHub Actions run ID" }),
});

export type FirmwareCreate = z.infer<typeof FirmwareCreateSchema>;
export type FirmwareFlash = z.infer<typeof FirmwareFlashSchema>;
