import { Parser, Language } from "web-tree-sitter";
import { join } from "path";
import type { Hook } from "../app.ts";

export async function initParser(context: Hook) {
  if (context.app.get("c-parser")) return;

  await Parser.init();
  const parser = new Parser();
  const wasmPath = join(context.app.get("root"), "tree-sitter-c.wasm");
  const lang = await Language.load(wasmPath);
  parser.setLanguage(lang);
  context.app.set("c-parser", parser);
}

export default {
  before: {
    create: [initParser],
  },
};
