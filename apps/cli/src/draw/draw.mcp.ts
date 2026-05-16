import { DrawSchema } from "./draw.schema.ts";

export default {
  tool: "keymap-draw",
  description: "Generate keymap SVG diagram for a keyboard",
  resolves: "create",
  schema: DrawSchema,
};
