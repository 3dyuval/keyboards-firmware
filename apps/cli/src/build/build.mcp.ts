import { z } from "zod";

export const buildFirmwareMcp = {
  tool: "build-firmware",
  description: "Start a local firmware build via Docker. Returns a jobId immediately — poll get-build-status to check completion.",
  resolves: "create",
  schema: z.object({
    target: z.enum(["zmk", "qmk", "all"]).default("zmk").describe("Which firmware to build"),
  }),
};

export const getBuildStatusMcp = {
  tool: "get-build-status",
  description: "Check the status of a firmware build job. Returns status (running/done/failed) and artifact paths when done.",
  resolves: "get",
  idParam: "id",
  schema: z.object({
    id: z.string().describe("Job ID returned by build-firmware"),
  }),
};
