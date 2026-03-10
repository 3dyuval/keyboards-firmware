import { Parser, Language } from "web-tree-sitter";
import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import type { Hook } from "../app.ts";

const WASM_NAME = "tree-sitter-c.wasm";

export async function initParser(context: Hook) {
  if (context.app.get("c-parser")) return;

  const cacheDir = dirname(context.app.get("cacheDir"));
  const wasmPath = join(cacheDir, WASM_NAME);

  if (!existsSync(wasmPath)) {
    const src = join(context.app.get("root"), WASM_NAME);
    mkdirSync(cacheDir, { recursive: true });
    await Bun.write(wasmPath, Bun.file(src));
  }

  await Parser.init();
  const parser = new Parser();
  const lang = await Language.load(wasmPath);
  parser.setLanguage(lang);
  context.app.set("c-parser", parser);
}

export default {
  before: {
    create: [initParser],
  },
};
