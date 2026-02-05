import { writeFileSync } from "fs";
import { resolve } from "path";
import { resolveAll, resolveOne } from "./config";
import { toButtons, toSvg } from "./transform";
import { serve } from "./server";

const args = process.argv.slice(2);
const cmd = args[0];

if (cmd === "serve") {
  const port = Number(args[1]) || 3333;
  serve(port);
} else if (cmd === "html" || cmd === "svg") {
  // bun run index.ts html [keyboard] [layer]
  // bun run index.ts svg [keyboard] [layer]
  const name = args[1];
  const layer = args[2] || "Base";

  if (!name) {
    // All keyboards, all layers
    const keyboards = resolveAll();
    for (const kb of keyboards) {
      for (const l of Object.keys(kb.keymap.layers)) {
        const ext = cmd === "svg" ? "svg" : "html";
        const out = cmd === "svg" ? toSvg(kb, l) : toButtons(kb, l);
        const path = resolve("out", `${kb.name}-${l}.${ext}`);
        writeFileSync(path, out);
        console.log(`  ${path}`);
      }
    }
  } else {
    const kb = resolveOne(name);
    const out = cmd === "svg" ? toSvg(kb, layer) : toButtons(kb, layer);
    console.log(out);
  }
} else {
  console.log(`Usage:
  bun run index.ts serve [port]     Start dev server (default: 3333)
  bun run index.ts html [kb] [layer]  Output HTML buttons (stdout or out/)
  bun run index.ts svg [kb] [layer]   Output SVG (stdout or out/)`);
}
