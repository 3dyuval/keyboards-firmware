import type { Params } from "@feathersjs/feathers";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { BaseService } from "../app.ts";
import { DrawSchema } from "./draw.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";

export default class DrawService extends BaseService {
  schema = DrawSchema;

  async *create(data: any, params: Params): AsyncGenerator<ServiceEvent> {
    const { payload, keyboardConfig } = params as any;
    const { outputDir, config: configPath } = this.app.get("draw");
    mkdirSync(outputDir, { recursive: true });

    yield ["venv", "ensuring python venv...", undefined];
    const bin = this.ensureVenv();

    const format = payload.format;
    const src = payload.src;

    if (format === "qmk") {
      yield ["parsing", `parsing QMK keymap...`, undefined];
      const result = await this.drawQmk(src, payload.type, bin, outputDir, configPath);
      yield ["done", "done", result];
    } else {
      yield ["parsing", `parsing ZMK keymap...`, undefined];
      const result = await this.drawZmk(src, payload.type, bin, outputDir, configPath);
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
    src: string,
    payloadType: "file" | "json",
    bin: string,
    outputDir: string,
    configPath: string,
  ) {
    const name = payloadType === "file" ? this.getNameFromPath(src) : "inline";
    
    let yaml: string;
    if (payloadType === "file") {
      yaml = this.keymap(bin, "-c", configPath, "parse", "-z", src);
    } else {
      // Write inline content to temp file for parsing
      const tempPath = join(outputDir, `${name}.keymap`);
      await Bun.write(tempPath, src);
      yaml = this.keymap(bin, "-c", configPath, "parse", "-z", tempPath);
    }
    
    const yamlPath = join(outputDir, `${name}.yaml`);
    await Bun.write(yamlPath, yaml);

    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outputDir, `${name}.svg`);
    await Bun.write(svgPath, svg);

    return { name, yaml: yamlPath, svg: svgPath };
  }

  private async drawQmk(
    src: string,
    payloadType: "file" | "json",
    bin: string,
    outputDir: string,
    configPath: string,
  ) {
    const name = payloadType === "file" ? this.getNameFromPath(src) : "inline";
    
    let jsonPath: string;
    let layerNames: string[] | undefined;
    
    if (payloadType === "file") {
      if (src.endsWith(".c")) {
        const result = await (this.app.service("parse") as any).create(
          { file: src },
          {},
        );
        jsonPath = join(outputDir, `${name}.json`);
        layerNames = result.layer_names;
        await Bun.write(jsonPath, JSON.stringify(result));
      } else {
        jsonPath = src;
      }
    } else {
      // Write inline JSON to temp file
      jsonPath = join(outputDir, `${name}.json`);
      await Bun.write(jsonPath, src);
    }

    const parseArgs = ["-c", configPath, "parse", "-q", jsonPath];
    if (layerNames?.length) parseArgs.push("-l", ...layerNames);
    const yaml = this.keymap(bin, ...parseArgs);
    const yamlPath = join(outputDir, `${name}.yaml`);
    await Bun.write(yamlPath, yaml);

    const svg = this.keymap(bin, "-c", configPath, "draw", yamlPath);
    const svgPath = join(outputDir, `${name}.svg`);
    await Bun.write(svgPath, svg);

    return { name, yaml: yamlPath, svg: svgPath };
  }

  private getNameFromPath(path: string): string {
    const basename = path.split("/").pop() || "unknown";
    return basename.split(".")[0] || "unknown";
  }
}
