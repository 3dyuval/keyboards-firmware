#!/usr/bin/env bun
/**
 * MCP-only entry point for compiled binary.
 * No filesystem config, no dynamic service scan.
 * All keyboard config comes via MCP tool params.
 */
import { feathers } from "@feathersjs/feathers";
import type { AppSettings } from "./types.d.ts";
import type { App } from "./src/app.ts";
import { BaseService } from "./src/app.ts";
import { mcpPresenter, startMcpServer, startMcpHttpServer } from "./lib/mcp.ts";

// ── minimal app (no config files) ──────────────────────────────────

const app: App = feathers<any, AppSettings>();

app.set("keyboards" as any, {});
app.set("logging" as any, {});

// ── static service registration ────────────────────────────────────

import KeyboardsService from "./src/keyboards/keyboards.service.ts";
import keyboardsMcp from "./src/keyboards/keyboards.mcp.ts";

import DrawService from "./src/draw/draw.service.ts";
import drawHooks from "./src/draw/draw.hooks.ts";
import drawMcp from "./src/draw/draw.mcp.ts";

const keyboards = new KeyboardsService(app);
(keyboards as any).expose = { mcp: keyboardsMcp };
app.use("keyboards", keyboards);

const draw = new DrawService(app);
(draw as any).expose = { mcp: drawMcp };
app.use("draw", draw);
app.service("draw").hooks(drawHooks);

// ── global hooks ───────────────────────────────────────────────────

app.hooks({
  after: { all: [mcpPresenter] },
});

// ── start ──────────────────────────────────────────────────────────

const useHttp = process.argv.includes("--http");
const port = (() => {
  const i = process.argv.indexOf("--port");
  return i !== -1 ? Number(process.argv[i + 1]) : 3001;
})();

if (useHttp) {
  await startMcpHttpServer(app, port);
} else {
  await startMcpServer(app);
}
