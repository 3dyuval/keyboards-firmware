#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { join } from "path";
import { app } from "./src/app.ts";
import { registerServices } from "./src/discover.ts";
import { AppContext, RootContext } from "./src/context.tsx";

// ── discover and register all services ──────────────────────────────

// drain the generator — Ink startup progress can consume events later
for await (const _ of registerServices(app, join(import.meta.dir, "src"))) {}

// ── resolve command → component from expose declarations ────────────

const [, , cmd] = process.argv;

function resolveCommand(command?: string) {
  for (const path of Object.keys(app.services)) {
    const service = app.service(path) as any;
    if (!service.expose?.cli) continue;
    if (service.expose.cli.command === command) {
      return service.expose.cli.component;
    }
  }
  return null;
}

const Component = resolveCommand(cmd);

if (!Component) {
  console.log("Usage: keyb1 <command>\n");
  console.log("Commands:");
  for (const path of Object.keys(app.services)) {
    const service = app.service(path) as any;
    if (!service.expose?.cli) continue;
    const { command } = service.expose.cli;
    const desc = service.expose.cli.description ?? "";
    console.log(`  ${command.padEnd(12)} ${desc}`);
  }
  process.exit(0);
}

// ── render ──────────────────────────────────────────────────────────

render(
  <AppContext.Provider value={app}>
    <RootContext.Provider value={true}>
      <Component />
    </RootContext.Provider>
  </AppContext.Provider>,
);
