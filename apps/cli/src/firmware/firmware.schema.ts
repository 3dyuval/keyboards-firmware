import { z } from "zod";

export const FirmwareCreateSchema = z.object({
  artifact: z.string().describe("Artifact name (e.g. totem-left) or path to .uf2/.bin file"),
});

export const FirmwareFlashSchema = z.object({
  artifact: z.string().describe("Artifact name (e.g. totem-left) or path to .uf2/.bin file"),
  source: z
    .enum(["local", "github", "auto"])
    .default("auto")
    .meta({ description: "Artifact source" }),
  run: z
    .string()
    .optional()
    .meta({ description: "Specific GitHub run ID" }),
  reset: z
    .boolean()
    .default(false)
    .meta({ alias: "r", description: "Reset settings before flash" }),
  yes: z
    .boolean()
    .default(false)
    .meta({ alias: "y", description: "Skip confirmation" }),
});

export type FirmwareCreate = z.infer<typeof FirmwareCreateSchema>;
export type FirmwareFlash = z.infer<typeof FirmwareFlashSchema>;
