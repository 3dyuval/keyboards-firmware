import { z } from "zod";

export default {
  tool: "List Keyboards",
  description: "List all configured keyboards with their type and workflow",
  resolves: "find",
  schema: z.object({
    type: z
      .enum(["zmk", "qmk"])
      .optional()
      .meta({ description: "Filter by firmware type" }),
  }),
};
