import { resolve } from "path";
import { readFileSync, existsSync } from "fs";

const CLIENT_DIR = resolve(import.meta.dir, "src/client");

const MIME: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
};

async function serveFile(path: string): Promise<Response> {
  const ext = path.slice(path.lastIndexOf("."));

  // Transpile .ts to .js on the fly
  if (ext === ".ts") {
    const result = await Bun.build({ entrypoints: [path], bundle: true });
    const js = await result.outputs[0].text();
    return new Response(js, { headers: { "Content-Type": "text/javascript" } });
  }

  if (!existsSync(path)) return new Response("Not found", { status: 404 });
  const content = readFileSync(path);
  return new Response(content, { headers: { "Content-Type": MIME[ext] || "application/octet-stream" } });
}

export function serve(port = 3333) {
  const s = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const filePath = resolve(CLIENT_DIR, "." + pathname);
      return serveFile(filePath);
    },
  });
  console.log(`http://localhost:${s.port}`);
  return s;
}
