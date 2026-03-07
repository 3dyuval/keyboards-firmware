import type { Application, Id, Params } from "@feathersjs/feathers";
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
    return this.app.get("draw") as { outputDir: string; config: string; qmkKeymap: string };
  }

  private venvDir() { return join(this.root, ".venv"); }

  private ensureVenv() {
    const venv = this.venvDir();
    if (!existsSync(venv)) {
      console.log("Creating venv...");
      const r = Bun.spawnSync(["python", "-m", "venv", venv]);
      if (r.exitCode !== 0) throw new Error("failed to create venv");
    }
    const keymapBin = join(venv, "bin", "keymap");
    if (!existsSync(keymapBin)) {
      console.log("Installing keymap-drawer...");
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

  private async drawZmk(kmap: string, bin: string, outDir: string, configPath: string) {
    const name = basename(kmap, ".keymap");
    console.log(`  ${name}`);
    const yaml = this.keymap(bin, "-c", configPath, "parse", "-z", kmap);
    const yamlPath = join(outDir, `${name}.yaml`);
    await Bun.write(yamlPath, yaml);
    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outDir, `${name}.svg`);
    await Bun.write(svgPath, svg);
    return { name, yaml: yamlPath, svg: svgPath };
  }

  private async drawQmk(bin: string, outDir: string, configPath: string, qmkPath: string) {
    console.log("  iris");
    const yaml = this.keymap(bin, "-c", configPath, "parse", "-q", qmkPath);
    const yamlPath = join(outDir, "iris.yaml");
    await Bun.write(yamlPath, yaml);
    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outDir, "iris.svg");
    await Bun.write(svgPath, svg);
    return { name: "iris", yaml: yamlPath, svg: svgPath };
  }

  // GET /draw — list what would be drawn
  async find(params: Params) {
    const glob = new Bun.Glob("*.keymap");
    const names: string[] = [];
    for (const file of glob.scanSync(join(this.root, "config"))) {
      names.push(file.replace(/\.keymap$/, ""));
    }
    const { qmkKeymap } = this.cfg();
    if (existsSync(join(this.root, qmkKeymap))) names.push("iris");
    return names.sort();
  }

  // GET /draw/:keyboard — draw a single keyboard
  async get(keyboard: Id, params: Params) {
    const kb = String(keyboard);
    const { outputDir, config: configFile, qmkKeymap } = this.cfg();
    const outDir = join(this.root, outputDir);
    const configPath = join(this.root, configFile);
    mkdirSync(outDir, { recursive: true });
    const bin = this.ensureVenv();

    if (kb === "iris") {
      const qmkPath = join(this.root, qmkKeymap);
      if (!existsSync(qmkPath)) throw new Error(`QMK keymap not found: ${qmkPath}`);
      console.log("Drawing QMK keymaps...");
      return this.drawQmk(bin, outDir, configPath, qmkPath);
    }

    const kmap = join(this.root, "config", `${kb}.keymap`);
    if (!existsSync(kmap)) throw new Error(`keymap not found: ${kmap}`);
    console.log("Drawing ZMK keymaps...");
    return this.drawZmk(kmap, bin, outDir, configPath);
  }

  // POST /draw — draw all keyboards
  async create(data: any, params: Params) {
    const { outputDir, config: configFile, qmkKeymap } = this.cfg();
    const outDir = join(this.root, outputDir);
    const configPath = join(this.root, configFile);
    mkdirSync(outDir, { recursive: true });
    const bin = this.ensureVenv();
    const results: any[] = [];

    console.log("Drawing ZMK keymaps...");
    const glob = new Bun.Glob("*.keymap");
    for (const file of glob.scanSync(join(this.root, "config"))) {
      results.push(await this.drawZmk(join(this.root, "config", file), bin, outDir, configPath));
    }

    const qmkPath = join(this.root, qmkKeymap);
    if (existsSync(qmkPath)) {
      console.log("Drawing QMK keymaps...");
      results.push(await this.drawQmk(bin, outDir, configPath, qmkPath));
    }

    console.log(`Done! Output in ${outDir}`);
    return results;
  }
}
