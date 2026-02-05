import keyboards from "./keyboards.json";

interface PhysKey { x: number; y: number; w: number; h: number; r?: number }
interface KeyEntry { t?: string; h?: string }
type KeyValue = string | KeyEntry;
interface Keyboard {
  name: string;
  physKeys: PhysKey[];
  layers: Record<string, KeyValue[]>;
}

function keyLabel(entry: KeyValue | undefined): { tap: string; hold: string } {
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

function renderKeyboard(kb: Keyboard, layerName: string): string {
  const pad = 4;
  const { minX, minY, maxX, maxY } = bounds(kb.physKeys);
  const width = maxX - minX + pad * 2;
  const height = maxY - minY + pad * 2;
  const keys = kb.layers[layerName] || [];

  const buttons = kb.physKeys
    .map((pk, i) => {
      const { tap, hold } = keyLabel(keys[i]);
      const x = pk.x - minX + pad;
      const y = pk.y - minY + pad;
      const w = pk.w - 4;
      const h = pk.h - 4;
      const rot = pk.r ? ` transform:rotate(${pk.r}deg);` : "";
      const cls = hold ? "key held" : "key";
      return `<button class="${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${rot}" data-i="${i}"><span class="tap">${tap}</span>${hold ? `<span class="hold">${hold}</span>` : ""}</button>`;
    })
    .join("\n");

  return `<div class="keyboard" style="width:${width}px;height:${height}px">${buttons}</div>`;
}

function render() {
  const app = document.getElementById("app")!;
  const sections = (keyboards as Keyboard[]).map((kb) => {
    const layerNames = Object.keys(kb.layers);
    const tabs = layerNames
      .map((l, i) => `<button class="tab${i === 0 ? " active" : ""}" data-kb="${kb.name}" data-layer="${l}">${l}</button>`)
      .join("");
    const panels = layerNames
      .map((l, i) => `<div class="panel${i === 0 ? " active" : ""}" data-kb="${kb.name}" data-layer="${l}">${renderKeyboard(kb, l)}</div>`)
      .join("");
    return `<section><h2>${kb.name}</h2><div class="tabs">${tabs}</div>${panels}</section>`;
  });

  app.innerHTML = sections.join("\n");

  // Tab switching
  app.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      const el = t as HTMLElement;
      const kb = el.dataset.kb!, layer = el.dataset.layer!;
      app.querySelectorAll(`.tab[data-kb="${kb}"]`).forEach((x) => x.classList.remove("active"));
      app.querySelectorAll(`.panel[data-kb="${kb}"]`).forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      app.querySelector(`.panel[data-kb="${kb}"][data-layer="${layer}"]`)!.classList.add("active");
    })
  );

  // Key selection toggle
  app.querySelectorAll(".key").forEach((k) =>
    k.addEventListener("click", () => k.classList.toggle("selected"))
  );
}

render();
