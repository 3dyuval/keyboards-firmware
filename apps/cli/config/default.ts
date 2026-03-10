import { join } from "path";

const dataHome =
  Bun.env.XDG_DATA_HOME ?? join(Bun.env.HOME!, ".local/share");

const dir = (rel: string) => join(dataHome, "keyb", rel);

const root =
  Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
    .stdout.toString()
    .trim() || ".";

export default function ({ defer }: any) {
  return {
    root,

    // Resolved under $XDG_DATA_HOME/keyb/
    // Override in local.ts to change the relative path
    cachePath: "firmware",
    cacheDir: defer((cfg: any) => dir(cfg.cachePath)),

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
