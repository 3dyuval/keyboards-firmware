#!/usr/bin/env bun
import React from "react";
import { render, Text } from "ink";
import { join } from "path";
import { app } from "./src/app.ts";
import { registerServices } from "./lib/register.ts";
import { AppContext, RootContext } from "./lib/context.tsx";
import { resolveCommand, allRoutes, parseArgs, routeUsage } from "./lib/route.ts";
import { discover } from "./lib/discover.ts";
import { mcpPresenter, startMcpServer, startMcpHttpServer } from "./lib/mcp.ts";

// ── bootstrap (shared across all modes) ─────────────────────────────

for await (const _ of registerServices(app, join(import.meta.dir, "src"))) {}

app.hooks({
  after: { all: [mcpPresenter] },
});

// ── mode dispatch ───────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;

if (cmd === "--mcp") {
  await startMcpServer(app);
} else if (cmd === "--mcp-http") {
  await startMcpHttpServer(app);
} else if (cmd === "--rest") {
  console.error("REST mode not yet implemented");
  process.exit(1);
} else if (cmd === "--discover") {
  discover(allRoutes(app.services), rest.includes("--json"));
  process.exit(0);
} else {
  // ── CLI mode ────────────────────────────────────────────────────

  const resolved = resolveCommand(app.services, cmd);

  if (!resolved) {
    if (cmd) console.error(`Unknown command: ${cmd}\n`);
    console.log("Usage: keyb <command>\n");
    console.log("Commands:");
    for (const route of allRoutes(app.services)) {
      const aliases = route.aliases ? `, ${route.aliases.join(", ")}` : "";
      const args = (route.args ?? [])
        .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
        .join(" ");
      const left = `${route.command}${aliases}${args ? " " + args : ""}`;
      console.log(`  ${left.padEnd(28)} ${route.description}`);
    }
    process.exit(cmd ? 1 : 0);
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

  const Component = route.component;

  class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error?: Error }
  > {
    state: { error?: Error } = {};
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    render() {
      if (this.state.error)
        return <Text color="red">Error: {this.state.error.message}</Text>;
      return this.props.children;
    }
  }

  render(
    <AppContext.Provider value={app}>
      <RootContext.Provider value={true}>
        <ErrorBoundary>
          <Component {...args} />
        </ErrorBoundary>
      </RootContext.Provider>
    </AppContext.Provider>,
  );
}
