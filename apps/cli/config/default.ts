import { join } from "path";

const root =
  Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
    .stdout.toString()
    .trim() || ".";

export default function ({ defer }: any) {
  return {
    root,

    cacheDir: defer((cfg: any) => join(cfg.root, ".cache/firmware")),

    // Keymap drawer settings for SVG generation
    draw: {
      outputDir: defer((cfg: any) => join(cfg.root, "keymap-drawer")),
      config: defer((cfg: any) => join(cfg.root, "keymap-drawer/config.yaml")),
    },

    // GitHub repository for CI workflow lookups
    // Auth token comes from GITHUB_TOKEN env or local.ts
    github: {
      owner: "",
      repo: "",
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
