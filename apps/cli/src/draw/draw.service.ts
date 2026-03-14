import type { Params } from "@feathersjs/feathers";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { BaseService } from "../app.ts";
import { DrawSchema } from "./draw.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export default class DrawService extends BaseService {
  schema = DrawSchema;

  async *create(data: any, params: Params): AsyncGenerator<ServiceEvent> {
    const { keyboard, keyboardConfig } = params as any;
    const { keymapPath } = keyboardConfig;
    const { outputDir, config: configPath } = this.app.get("draw");
    mkdirSync(outputDir, { recursive: true });

    yield ["venv", "ensuring python venv...", undefined];
    const bin = this.ensureVenv();

    if (keyboardConfig.type === "qmk") {
      yield ["parsing", `parsing QMK keymap for ${keyboard}...`, undefined];
      const result = await this.drawQmk(keymapPath, keyboard, bin, outputDir, configPath);
      yield ["done", "done", result];
    } else {
      yield ["parsing", `parsing ZMK keymap for ${keyboard}...`, undefined];
      const result = await this.drawZmk(keymapPath, keyboard, bin, outputDir, configPath);
      yield ["done", "done", result];
    }
  }

  private ensureVenv(): string {
    const root = this.app.get("root");
    const venv = join(root, ".venv");
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
    if (r.exitCode !== 0)
      throw new Error(r.stderr.toString() || `keymap ${args[0]} failed`);
    return r.stdout.toString();
  }

  private async drawZmk(
    keymapFile: string,
    kb: string,
    bin: string,
    outputDir: string,
    configPath: string,
  ) {
    const yaml = this.keymap(bin, "-c", configPath, "parse", "-z", keymapFile);
    const yamlPath = join(outputDir, `${kb}.yaml`);
    await Bun.write(yamlPath, yaml);

    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outputDir, `${kb}.svg`);
    await Bun.write(svgPath, svg);

    return { name: kb, yaml: yamlPath, svg: svgPath };
  }

  private async drawQmk(
    keymapFile: string,
    kb: string,
    bin: string,
    outputDir: string,
    configPath: string,
  ) {
    let jsonPath = keymapFile;
    let layerNames: string[] | undefined;
    if (keymapFile.endsWith(".c")) {
      const result = await (this.app.service("parse") as any).create(
        { file: keymapFile },
        {},
      );
      jsonPath = join(outputDir, `${kb}.json`);
      layerNames = result.layer_names;
      await Bun.write(jsonPath, JSON.stringify(result));
    }

    const parseArgs = ["-c", configPath, "parse", "-q", jsonPath];
    if (layerNames?.length) parseArgs.push("-l", ...layerNames);
    const yaml = this.keymap(bin, ...parseArgs);
    const yamlPath = join(outputDir, `${kb}.yaml`);
    await Bun.write(yamlPath, yaml);

    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outputDir, `${kb}.svg`);
    await Bun.write(svgPath, svg);

    return { name: kb, yaml: yamlPath, svg: svgPath };
  }
}
