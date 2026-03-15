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

// Set minimal defaults — MCP clients pass everything via params
app.set("keyboards" as any, {});
app.set("logging" as any, {});

// ── static service registration ────────────────────────────────────

import ConfigService from "./src/config/config.service.ts";
import configMcp from "./src/config/config.mcp.ts";

import KeyboardsService from "./src/keyboards/keyboards.service.ts";
import keyboardsMcp from "./src/keyboards/keyboards.mcp.ts";

import FirmwareService from "./src/firmware/firmware.service.ts";
import firmwareHooks from "./src/firmware/firmware.hooks.ts";
import firmwareMcp from "./src/firmware/firmware.mcp.ts";

import DrawService from "./src/draw/draw.service.ts";
import drawHooks from "./src/draw/draw.hooks.ts";
import drawMcp from "./src/draw/draw.mcp.ts";

import ParseService from "./src/parse/parse.service.ts";
import parseHooks from "./src/parse/parse.hooks.ts";
import parseMcp from "./src/parse/parse.mcp.ts";

const config = new ConfigService(app);
(config as any).expose = { mcp: configMcp };
app.use("config", config);

const keyboards = new KeyboardsService(app);
(keyboards as any).expose = { mcp: keyboardsMcp };
app.use("keyboards", keyboards);

const firmware = new FirmwareService(app);
(firmware as any).expose = { mcp: firmwareMcp };
app.use("firmware", firmware);
app.service("firmware").hooks(firmwareHooks);

const draw = new DrawService(app);
(draw as any).expose = { mcp: drawMcp };
app.use("draw", draw);
app.service("draw").hooks(drawHooks);

const parse = new ParseService(app);
(parse as any).expose = { mcp: parseMcp };
app.use("parse", parse);
app.service("parse").hooks(parseHooks);

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
  await startMcpHttpServer(app, port)
} else {
  await startMcpServer(app);
}
