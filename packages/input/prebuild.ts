// Pre-generates keyboard data JSON for the Vite client
import { writeFileSync } from "fs";
import { resolve } from "path";
import { resolveAll } from "./src/config/config";

const keyboards = resolveAll();

const data = keyboards.map((kb) => ({
  name: kb.name,
  physKeys: kb.physKeys,
  layers: kb.keymap.layers,
}));

const out = resolve(import.meta.dir, "src/client/keyboards.json");
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`Wrote ${out} (${keyboards.length} keyboards)`);
