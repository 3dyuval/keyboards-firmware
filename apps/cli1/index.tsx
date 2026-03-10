#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { join } from "path";
import { app } from "./src/app.ts";
import { registerServices } from "./src/lib/register.ts";
import { AppContext, RootContext } from "./src/lib/context.tsx";
import { resolveCommand, allRoutes, parseArgs, routeUsage } from "./src/lib/route.ts";
import { discover } from "./src/lib/discover.ts";

// ── discover and register all services ──────────────────────────────

for await (const _ of registerServices(app, join(import.meta.dir, "src"))) {}

// ── --discover flag ─────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;

if (cmd === "--discover") {
  const json = rest.includes("--json");
  discover(allRoutes(app.services), json);
  process.exit(0);
}

// ── resolve command → route + parsed args ───────────────────────────

const resolved = resolveCommand(app.services, cmd);

if (!resolved) {
  if (cmd) console.error(`Unknown command: ${cmd}\n`);
  console.log("Usage: keyb1 <command>\n");
  console.log("Commands:");
  for (const route of allRoutes(app.services)) {
    const aliases = route.aliases ? `, ${route.aliases.join(", ")}` : "";
    const args = (route.args ?? [])
      .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
      .join(" ");
    const left = `${route.command}${aliases}${args ? " " + args : ""}`;
    console.log(`  ${left.padEnd(28)} ${route.description}`);
  }
  process.exit(0);
}

const { route } = resolved;

let args: Record<string, any>;
try {
  args = parseArgs(rest, route);
} catch (err: any) {
  console.error(`${route.command}: ${err.message}`);
  console.error(`Usage: ${routeUsage(route)}`);
  process.exit(1);
}

// ── render ──────────────────────────────────────────────────────────

const Component = route.component;

render(
  <AppContext.Provider value={app}>
    <RootContext.Provider value={true}>
      <Component {...args} />
    </RootContext.Provider>
  </AppContext.Provider>,
);
