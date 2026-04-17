import { FirmwareCreateSchema } from "./firmware.schema.ts";

export default {
  tool: "get-firmware",
  description: "Download firmware artifact for a keyboard from GitHub Actions or local build cache. Returns the local path to the firmware file (.uf2 for ZMK, .bin for QMK).",
  resolves: "create",
  schema: FirmwareCreateSchema,
};
