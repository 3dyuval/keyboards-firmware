#!/usr/bin/env bun
/**
 * MCP-only entry point for compiled binary.
 * No dynamic service scan — services registered statically.
 * Keyboard config loaded from local.json5 via feathers configuration.
 */
import { app } from "./src/app.ts";
import { mcpPresenter, startMcpServer, startMcpHttpServer } from "./lib/mcp.ts";

// ── static service registration ────────────────────────────────────

import KeyboardsService from "./src/keyboards/keyboards.service.ts";
import keyboardsMcp from "./src/keyboards/keyboards.mcp.ts";

import ParseService from "./src/parse/parse.service.ts";
import parseHooks from "./src/parse/parse.hooks.ts";

import DrawService from "./src/draw/draw.service.ts";
import drawHooks from "./src/draw/draw.hooks.ts";
import drawMcp from "./src/draw/draw.mcp.ts";

const keyboards = new KeyboardsService(app);
(keyboards as any).expose = { mcp: keyboardsMcp };
app.use("keyboards", keyboards);

const parse = new ParseService(app);
app.use("parse", parse);
app.service("parse").hooks(parseHooks);

const draw = new DrawService(app);
(draw as any).expose = { mcp: drawMcp };
app.use("draw", draw);
app.service("draw").hooks(drawHooks);

// ── global hooks ───────────────────────────────────────────────────

app.hooks({
  after: { all: [mcpPresenter] },
});

// ── start ──────────────────────────────────────────────────────────

if (process.argv.includes("--http")) {
  await startMcpHttpServer(app);
} else {
  await startMcpServer(app);
}
