import type { Application, Params } from "@feathersjs/feathers";
import { existsSync, mkdirSync } from "fs";
import { join, basename } from "path";

export class DrawService {
  private root: string;
  private app: Application;

  constructor(root: string, app: Application) {
    this.root = root;
    this.app = app;
  }

  private cfg() {
    return this.app.get("draw") as { outputDir: string; config: string };
  }

  private venvDir() { return join(this.root, ".venv"); }

  private ensureVenv() {
    const venv = this.venvDir();
    if (!existsSync(venv)) {
      console.debug("Creating venv...");
      const r = Bun.spawnSync(["python", "-m", "venv", venv]);
      if (r.exitCode !== 0) throw new Error("failed to create venv");
    }
    const keymapBin = join(venv, "bin", "keymap");
    if (!existsSync(keymapBin)) {
      console.debug("Installing keymap-drawer...");
      const r = Bun.spawnSync([join(venv, "bin", "pip"), "install", "keymap-drawer"]);
      if (r.exitCode !== 0) throw new Error("failed to install keymap-drawer");
    }
    return keymapBin;
  }

  private keymap(bin: string, ...args: string[]): string {
    const r = Bun.spawnSync([bin, ...args], { stderr: "pipe" });
    if (r.exitCode !== 0) throw new Error(r.stderr.toString() || `keymap ${args[0]} failed`);
    return r.stdout.toString();
  }

  private async drawZmk(keymapFile: string, kb: string, bin: string, outDir: string, configPath: string) {
    console.debug(`  ${kb}`);
    const yaml = this.keymap(bin, "-c", configPath, "parse", "-z", keymapFile);
    const yamlPath = join(outDir, `${kb}.yaml`);
    await Bun.write(yamlPath, yaml);
    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outDir, `${kb}.svg`);
    await Bun.write(svgPath, svg);
    return { name: kb, yaml: yamlPath, svg: svgPath };
  }

  private async drawQmk(keymapFile: string, kb: string, bin: string, outDir: string, configPath: string) {
    console.debug(`  ${kb}`);

    let jsonPath = keymapFile;
    if (keymapFile.endsWith(".c")) {
      const result = await this.app.service("parse").create({ file: keymapFile }, {});
      jsonPath = join(outDir, `${kb}.json`);
      await Bun.write(jsonPath, JSON.stringify(result));
    }

    const yaml = this.keymap(bin, "-c", configPath, "parse", "-q", jsonPath);
    const yamlPath = join(outDir, `${kb}.yaml`);
    await Bun.write(yamlPath, yaml);
    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outDir, `${kb}.svg`);
    await Bun.write(svgPath, svg);
    return { name: kb, yaml: yamlPath, svg: svgPath };
  }

  // POST /keyboards/:keyboardId/draw — draw a single keyboard
  async create(data: any, params: Params) {
    const { keyboard, keyboardConfig } = params as any;
    const { keymapPath } = keyboardConfig;

    if (!existsSync(keymapPath)) throw new Error(`keymap not found: ${keymapPath}`);

    const { outputDir, config: configFile } = this.cfg();
    const outDir = join(this.root, outputDir);
    const configPath = join(this.root, configFile);
    mkdirSync(outDir, { recursive: true });
    const bin = this.ensureVenv();

    if (keyboardConfig.type === "qmk") {
      console.debug("Drawing QMK keymaps...");
      return this.drawQmk(keymapPath, keyboard, bin, outDir, configPath);
    }

    console.debug("Drawing ZMK keymaps...");
    return this.drawZmk(keymapPath, keyboard, bin, outDir, configPath);
  }
}
