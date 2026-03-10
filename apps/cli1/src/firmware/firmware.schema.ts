import { z } from "zod";

export const FirmwareCreateSchema = z.object({
  keyboard: z.string(),
});

export const FirmwareFlashSchema = z.object({
  keyboard: z.string(),
  side: z.string().optional(),
  reset: z.boolean().default(false),
  yes: z.boolean().default(false),
});

export type FirmwareCreate = z.infer<typeof FirmwareCreateSchema>;
export type FirmwareFlash = z.infer<typeof FirmwareFlashSchema>;
