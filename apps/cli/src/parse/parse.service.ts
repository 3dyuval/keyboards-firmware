import type { Parser } from "web-tree-sitter";
import type { Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { ParseSchema } from "./parse.schema.ts";

interface Layer {
  name: string;
  layout: string;
  keycodes: string[];
}

export interface KeymapJson {
  version: number;
  keyboard: string;
  keymap: string;
  layout: string;
  layers: string[][];
  layer_names: string[];
}

export default class ParseService extends BaseService {
  schema = ParseSchema;

  async create(
    data: { file: string; keyboard?: string; keymap?: string },
    params: Params,
  ): Promise<KeymapJson> {
    const p = this.app.get("c-parser")!;
    const source = await Bun.file(data.file).text();
    const tree = p.parse(source);
    if (!tree) throw new Error("failed to parse file");
    const root = tree.rootNode;

    const layers = this.extractLayers(root);
    if (!layers.length) throw new Error("no layers found in keymap");

    const layerNameMap = this.extractLayerNames(root);
    const layout = layers[0].layout;

    const sortedLayers = layers
      .map((l) => ({
        ...l,
        index: layerNameMap[l.name] ?? (parseInt(l.name) || 0),
      }))
      .sort((a, b) => a.index - b.index);

    const jsonLayers = sortedLayers.map((l) =>
      l.keycodes.map((kc) => {
        if (kc === "_______") return "KC_TRNS";
        if (kc === "XXXXXXX") return "KC_NO";
        return kc;
      }),
    );

    const keyboard =
      data.keyboard ??
      (data.file.match(/keyboards\/(.+?)\/keymaps/)?.[1] ?? "unknown");
    const keymap =
      data.keymap ??
      (data.file.match(/keymaps\/(.+?)\//)?.[1] ?? "default");

    return {
      version: 1,
      keyboard,
      keymap,
      layout,
      layers: jsonLayers,
      layer_names: sortedLayers.map((l) => l.name),
    };
  }

  private findKeymaps(node: any): any {
    if (node.type === "init_declarator" && node.text.includes("keymaps"))
      return node;
    for (let i = 0; i < node.childCount; i++) {
      const r = this.findKeymaps(node.child(i));
      if (r) return r;
    }
    return null;
  }

  private extractLayers(root: any): Layer[] {
    const layers: Layer[] = [];

    const initDecl = this.findKeymaps(root);
    if (!initDecl) throw new Error("keymaps[][] array not found");

    const value = initDecl.childForFieldName("value");
    if (!value) throw new Error("keymaps initializer not found");

    for (let i = 0; i < value.childCount; i++) {
      const child = value.child(i);
      if (child.type !== "initializer_pair") continue;

      const designator = child.child(0);
      const layerName =
        designator?.text?.replace(/^\[|\]$/g, "") ?? String(layers.length);

      const call = child.childForFieldName("value");
      if (!call || call.type !== "call_expression") continue;

      const layoutMacro = call.childForFieldName("function")?.text ?? "LAYOUT";
      const args = call.childForFieldName("arguments");
      if (!args) continue;

      const keycodes: string[] = [];
      for (let j = 0; j < args.childCount; j++) {
        const arg = args.child(j);
        if (arg.type === "," || arg.type === "(" || arg.type === ")") continue;
        keycodes.push(arg.text);
      }

      layers.push({ name: layerName, layout: layoutMacro, keycodes });
    }

    return layers;
  }

  private extractLayerNames(root: any): Record<string, number> {
    const names: Record<string, number> = {};

    const walkEnums = (node: any) => {
      if (node.type === "enum_specifier") {
        const body = node.childForFieldName("body");
        if (!body) return;
        let idx = 0;
        for (let i = 0; i < body.childCount; i++) {
          const child = body.child(i);
          if (child.type === "enumerator") {
            const name = child.childForFieldName("name")?.text;
            const val = child.childForFieldName("value")?.text;
            if (name && val && !isNaN(Number(val))) {
              names[name] = Number(val);
              idx = Number(val) + 1;
            } else if (name) {
              names[name] = idx++;
            }
          }
        }
      }
      for (let i = 0; i < node.childCount; i++) walkEnums(node.child(i));
    };

    walkEnums(root);
    return names;
  }
}
