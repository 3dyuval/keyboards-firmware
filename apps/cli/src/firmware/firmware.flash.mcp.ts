import { FirmwareFlashSchema } from "./firmware.schema.ts";

export default {
  tool: "flash-firmware",
  description: "Flash firmware to a keyboard. The keyboard must be put into bootloader mode (double-tap reset). Resolves firmware from local build cache, CI cache, or downloads from GitHub Actions.",
  resolves: "patch",
  idParam: "artifact",
  schema: FirmwareFlashSchema,
};
