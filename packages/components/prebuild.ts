import { writeFileSync } from "fs";
import { resolve } from "path";
import { resolveAll } from "config";

const keyboards = resolveAll();

const data = keyboards.map((kb) => ({
  name: kb.name,
  physKeys: kb.physKeys,
  layers: kb.keymap.layers,
}));

const out = resolve(import.meta.dirname, "dev/keyboards.json");
writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`Wrote ${out} (${keyboards.length} keyboards)`);
