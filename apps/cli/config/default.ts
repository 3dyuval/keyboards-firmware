import { join } from "path";

const root =
  Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
    .stdout.toString()
    .trim() || ".";

export default function ({ defer }: any) {
  return {
    root,

    cacheDir: defer((cfg: any) => join(cfg.root, ".cache/firmware")),
    buildDir: defer((cfg: any) => join(cfg.root, ".cache")),

    // Keymap drawer settings for SVG generation
    draw: {
      outputDir: defer((cfg: any) => join(cfg.root, "keymap-drawer")),
      config: defer((cfg: any) => join(cfg.root, "keymap-drawer/config.yaml")),
    },

    // MCP HTTP server settings
    mcp: {
      port: 3001,
      idleTimeout: 10,
    },

    // GitHub repository for CI workflow lookups
    // Auth token comes from GITHUB_TOKEN env or local.ts
    github: {
      owner: "",
      repo: "",
    },

    // Flash presets — base profiles for firmware flashing
    flashPresets: {
      // RP2040 — UF2 mass-storage (RPI-RP2 drive)
      rp2040:         { method: "mass-storage", label: "RPI-RP2" },

      // nRF52840 — DFU mode (nice!nano, XIAO-SENSE, etc.)
      dfu:            { method: "dfu",     device: "0483:df11", address: "0x08000000" },

      // nRF52840 — UF2 mass-storage (Adafruit Feather bootloader)
      feather-nrf52840: { method: "mass-storage", label: "FEATHERBOOT" },

      // ZMK generic — mass-storage on Nordic boards with ZMK bootloader
      zmk:            { method: "mass-storage", labels: ["NICENANO", "XIAO-SENSE"] },
    },

    // Which service methods to log (per service path)
    logging: {
      flash: ["create"],
      firmware: ["create", "get"],
      draw: ["create", "get"],
      parse: ["create"],
      status: ["find", "get"],
    },
  };
}
