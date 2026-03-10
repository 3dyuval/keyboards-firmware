import { Parser, Language } from "web-tree-sitter";
import { join } from "path";
import type { HookContext } from "@feathersjs/feathers";

export async function initParser(context: HookContext) {
  const cached = context.app.get("c-parser");
  if (cached) {
    context.params.parser = cached;
    return;
  }
  await Parser.init();
  const parser = new Parser();
  const wasmPath = join(import.meta.dir, "..", "tree-sitter-c.wasm");
  const lang = await Language.load(wasmPath);
  parser.setLanguage(lang);
  context.app.set("c-parser", parser);
  context.params.parser = parser;
}

export const parseHooks = {
  before: {
    create: [initParser],
  },
};
