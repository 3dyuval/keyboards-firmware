import { resolveAll } from "./config";
import { toButtons } from "./transform";

const CSS = `
:root { color-scheme: dark }
body { background:#1a1b26; color:#c0caf5; font-family:system-ui,sans-serif; max-width:1100px; margin:0 auto; padding:2rem }
h1 { border-bottom:1px solid #292e42; padding-bottom:.3em }
h2 { color:#7aa2f7; margin-bottom:.5rem }
section { margin-bottom:3rem }
.tabs { display:flex; gap:4px; margin-bottom:1rem }
.tab { background:#292e42; color:#565f89; border:1px solid #3b4261; border-radius:4px; padding:4px 12px; cursor:pointer; font-size:13px }
.tab.active { background:#3b4261; color:#c0caf5; border-color:#7aa2f7 }
.panel { display:none }
.panel.active { display:block }
.keyboard { position:relative; margin:0 auto }
.key { position:absolute; background:#292e42; border:1px solid #3b4261; border-radius:6px; color:#c0caf5; font-family:monospace; font-size:12px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; padding:2px; box-sizing:border-box; transition:background .1s,border-color .1s }
.key:hover { background:#3b4261; border-color:#7aa2f7 }
.key.held { border-color:#e0af68 }
.key.selected { background:#7aa2f7; color:#1a1b26; border-color:#7aa2f7 }
.key.selected .hold { color:#1a1b26 }
.tap { font-size:11px; font-weight:600 }
.hold { font-size:8px; color:#7aa2f7 }
`;

const JS = `
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  const kb=t.dataset.kb,layer=t.dataset.layer;
  document.querySelectorAll('.tab[data-kb="'+kb+'"]').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.panel[data-kb="'+kb+'"]').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  document.querySelector('.panel[data-kb="'+kb+'"][data-layer="'+layer+'"]').classList.add('active');
}));
document.querySelectorAll('.key').forEach(k=>k.addEventListener('click',()=>k.classList.toggle('selected')));
`;

function buildPage(): string {
  const keyboards = resolveAll();

  const sections = keyboards
    .map((kb) => {
      const layerNames = Object.keys(kb.keymap.layers);
      const tabs = layerNames
        .map((l, i) => `<button class="tab${i === 0 ? " active" : ""}" data-kb="${kb.name}" data-layer="${l}">${l}</button>`)
        .join("");
      const panels = layerNames
        .map((l, i) => `<div class="panel${i === 0 ? " active" : ""}" data-kb="${kb.name}" data-layer="${l}">${toButtons(kb, l)}</div>`)
        .join("");
      return `<section><h2>${kb.name}</h2><div class="tabs">${tabs}</div>${panels}</section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keyboard Layouts</title>
<style>${CSS}</style></head><body>
<h1>Keyboard Layouts</h1>
${sections}
<script>${JS}</script></body></html>`;
}

export function serve(port = 3333) {
  const s = Bun.serve({
    port,
    fetch: () => new Response(buildPage(), { headers: { "Content-Type": "text/html" } }),
  });
  console.log(`http://localhost:${s.port}`);
  return s;
}
