import { DrawSchema } from "./draw.schema.ts";

export default {
  tool: "draw-keymap",
  description: "Generate keymap SVG diagram for a keyboard",
  resolves: "create",
  schema: DrawSchema,
};
