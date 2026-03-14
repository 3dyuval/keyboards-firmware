import { z } from "zod";
import { KeyboardSchema } from "../src/keyboards/keyboards.schema.ts";

export const ConfigSchema = z.object({
  root: z.string(),
  cacheDir: z.string(),

  draw: z.object({
    outputDir: z.string(),
    config: z.string(),
  }),

  github: z.object({
    owner: z.string(),
    repo: z.string(),
  }).optional(),

  logging: z.record(z.string(), z.array(z.string())),

  keyboards: z.record(z.string(), KeyboardSchema),
});

export type Config = z.infer<typeof ConfigSchema>;

// @feathersjs/configuration calls schema.validate(config)
// Zod uses .parse() — alias it
export const configValidator = Object.assign(ConfigSchema, {
  validate: ConfigSchema.parse.bind(ConfigSchema),
}) as any;
