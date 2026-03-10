#!/usr/bin/env bun
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Config dir must be set before node-config initializes via @feathersjs/configuration
const __dir = dirname(fileURLToPath(import.meta.url));
process.env.NODE_CONFIG_DIR ??= join(__dir, "config");

const { app } = await import("./src/app.ts");
const { registerServices } = await import("./lib/register.ts");
const { AppContext, RootContext } = await import("./lib/context.tsx");
const { resolveCommand, allRoutes, parseArgs, routeUsage } = await import("./lib/route.ts");
const { discover } = await import("./lib/discover.ts");
const { mcpPresenter, mcpErrorHandler, startMcpServer } = await import("./lib/mcp.ts");
const React = (await import("react")).default;
const { render } = await import("ink");

// ── bootstrap (shared across all modes) ─────────────────────────────

for await (const _ of registerServices(app, join(import.meta.dir, "src"))) {}

app.hooks({
  after: { all: [mcpPresenter] },
  error: { all: [mcpErrorHandler] },
});

// ── mode dispatch ───────────────────────────────────────────────────

const [, , cmd, ...rest] = process.argv;

if (cmd === "--mcp") {
  await startMcpServer(app);
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

  render(
    <AppContext.Provider value={app}>
      <RootContext.Provider value={true}>
        <Component {...args} />
      </RootContext.Provider>
    </AppContext.Provider>,
  );
}
