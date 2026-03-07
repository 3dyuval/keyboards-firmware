import type { PhysKey, KeyEntry, ResolvedKeyboard } from "./config";

function keyLabel(entry: KeyEntry | undefined): { tap: string; hold: string } {
  if (!entry) return { tap: "", hold: "" };
  if (typeof entry === "string") return { tap: entry, hold: "" };
  return { tap: (entry.t === "▽" ? "" : entry.t) ?? "", hold: entry.h ?? "" };
}

function bounds(keys: PhysKey[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    minX = Math.min(minX, k.x);
    minY = Math.min(minY, k.y);
    maxX = Math.max(maxX, k.x + k.w);
    maxY = Math.max(maxY, k.y + k.h);
  }
  return { minX, minY, maxX, maxY };
}

// --- HTML buttons output ---

export function toButtons(kb: ResolvedKeyboard, layer: string, scale = 1): string {
  const pad = 4;
  const { minX, minY, maxX, maxY } = bounds(kb.physKeys);
  const width = (maxX - minX) * scale + pad * 2;
  const height = (maxY - minY) * scale + pad * 2;
  const keys = kb.keymap.layers[layer] || [];

  const buttons = kb.physKeys
    .map((pk, i) => {
      const { tap, hold } = keyLabel(keys[i]);
      const x = (pk.x - minX) * scale + pad;
      const y = (pk.y - minY) * scale + pad;
      const w = pk.w * scale - 4;
      const h = pk.h * scale - 4;
      const rot = pk.r ? ` transform:rotate(${pk.r}deg);` : "";
      const cls = hold ? "key held" : "key";
      return `<button class="${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${rot}" data-i="${i}"><span class="tap">${tap}</span>${hold ? `<span class="hold">${hold}</span>` : ""}</button>`;
    })
    .join("\n");

  return `<div class="keyboard" style="width:${width}px;height:${height}px">${buttons}</div>`;
}

// --- SVG output ---

export function toSvg(kb: ResolvedKeyboard, layer: string, scale = 1): string {
  const pad = 4;
  const { minX, minY, maxX, maxY } = bounds(kb.physKeys);
  const width = (maxX - minX) * scale + pad * 2;
  const height = (maxY - minY) * scale + pad * 2;
  const keys = kb.keymap.layers[layer] || [];

  const rects = kb.physKeys
    .map((pk, i) => {
      const { tap, hold } = keyLabel(keys[i]);
      const x = (pk.x - minX) * scale + pad;
      const y = (pk.y - minY) * scale + pad;
      const w = pk.w * scale - 4;
      const h = pk.h * scale - 4;
      const rot = pk.r ? ` transform="rotate(${pk.r} ${x + w / 2} ${y + h / 2})"` : "";
      const cls = hold ? "key held" : "key";
      const tapY = hold ? y + h / 2 - 4 : y + h / 2 + 2;
      return `<g${rot}><rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/><text class="tap" x="${x + w / 2}" y="${tapY}">${tap}</text>${hold ? `<text class="hold" x="${x + w / 2}" y="${y + h / 2 + 10}">${hold}</text>` : ""}</g>`;
    })
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<style>
.key { fill:#292e42; stroke:#3b4261; stroke-width:1 }
.key.held { stroke:#e0af68 }
.tap { font:600 11px monospace; fill:#c0caf5; text-anchor:middle; dominant-baseline:middle }
.hold { font:8px monospace; fill:#7aa2f7; text-anchor:middle; dominant-baseline:middle }
</style>
<rect width="100%" height="100%" fill="#1a1b26"/>
${rects}
</svg>`;
}
