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
import { mcpPresenter, mcpErrorHandler, startMcpServer } from "./lib/mcp.ts";

// ── minimal app (no config files) ──────────────────────────────────

const app: App = feathers<any, AppSettings>();

// Set minimal defaults — MCP clients pass everything via params
app.set("keyboards" as any, {});
app.set("logging" as any, {});

// ── static service registration ────────────────────────────────────

import DrawService from "./src/draw/draw.service.ts";
import drawHooks from "./src/draw/draw.hooks.ts";
import drawMcp from "./src/draw/draw.mcp.ts";

import ParseService from "./src/parse/parse.service.ts";
import parseHooks from "./src/parse/parse.hooks.ts";

const draw = new DrawService(app);
(draw as any).expose = { mcp: drawMcp };
app.use("draw", draw);
app.service("draw").hooks(drawHooks);

const parse = new ParseService(app);
app.use("parse", parse);
app.service("parse").hooks(parseHooks);

// ── global hooks ───────────────────────────────────────────────────

app.hooks({
  after: { all: [mcpPresenter] },
  error: { all: [mcpErrorHandler] },
});

// ── start ──────────────────────────────────────────────────────────

await startMcpServer(app);
