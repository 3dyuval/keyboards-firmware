import { z } from "zod";

export default {
  tool: "list-keyboards",
  description: "List all configured keyboards with their type and workflow",
  resolves: "find",
  schema: z.object({
    type: z
      .enum(["zmk", "qmk"])
      .optional()
      .meta({ description: "Filter by firmware type" }),
  }),
};
