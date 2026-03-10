import { DrawSchema } from "./draw.schema.ts";

export default {
  tool: "Draw Keymap",
  description: "Generate keymap SVG diagram for a keyboard",
  resolves: "create",
  schema: DrawSchema,
};
