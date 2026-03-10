import { DrawSchema } from "./draw.schema.ts";

export default {
  tool: "draw_keymap",
  description: "Generate keymap SVG diagram for a keyboard",
  resolves: "create",
  schema: DrawSchema,
};
