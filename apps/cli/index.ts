#!/usr/bin/env bun
import {
  feathers,
  type HookContext,
  type NextFunction,
} from "@feathersjs/feathers";
import configuration from "@feathersjs/configuration";
import { join } from "path";
import { mkdirSync } from "fs";

import { DrawService } from "./src/draw.ts";
import { FirmwareService } from "./src/firmware.ts";
import { firmwareHooks } from "./src/firmware.hooks.ts";
import { KeyboardsService } from "./src/keyboards.ts";
import { LogService } from "./src/log.ts";

// ── suppress debug logs in production ────────────────────────────────
if (process.env.NODE_ENV !== "development") {
  console.debug = () => {};
}

// ── constants ────────────────────────────────────────────────────────

const ROOT =
  Bun.spawnSync(["git", "rev-parse", "--show-toplevel"])
    .stdout.toString()
    .trim() || ".";
const CACHE = join(ROOT, ".cache/artifacts");
const DB_PATH = join(import.meta.dir, "db", "fw.sqlite");

mkdirSync(join(ROOT, ".cache"), { recursive: true });

// ── app ──────────────────────────────────────────────────────────────

type Services = {
  draw: DrawService;
  firmware: FirmwareService;
  keyboards: KeyboardsService;
  log: LogService;
};

const app = feathers<Services>().configure(configuration());

app.set("cacheDir", CACHE);

app.use("log", new LogService(DB_PATH, app));
app.use("draw", new DrawService(ROOT, app));
app.use("firmware", new FirmwareService(app));
app.use("keyboards", new KeyboardsService(app));

app.service("firmware").hooks(firmwareHooks);

// ── global event-log hooks ───────────────────────────────────────────

function contextMeta(context: HookContext) {
  const data = context.data ?? {};
  const result = context.result ?? {};
  return {
    service: context.path,
    method: context.method,
    keyboard: data.keyboard ?? result.keyboard ?? result.name,
    side: data.side ?? result.side,
    runId: result.runId,
    workflow:
      data.workflow ?? result.workflow ?? context.params?.query?.workflow,
    detail:
      result.cached != null
        ? result.cached
          ? "cache-hit"
          : "cache-miss"
        : (result.artifact ?? result.firmware ?? result.svg),
  };
}

app.hooks({
  before: {
    all: [
      async (context: HookContext) => {
        if (context.path === "log") return;
        await app
          .service("log")
          .create({ phase: "before", ...contextMeta(context) });
      },
    ],
  },
  after: {
    all: [
      async (context: HookContext) => {
        if (context.path === "log") return;
        await app
          .service("log")
          .create({ phase: "after", ...contextMeta(context) });
      },
    ],
  },
  error: {
    all: [
      async (context: HookContext) => {
        if (context.path === "log") return;
        await app.service("log").create({
          phase: "error",
          ...contextMeta(context),
          error: context.error?.message ?? String(context.error),
        });
      },
    ],
  },
});

// ── export app for programmatic use ──────────────────────────────────

export { app };

// ── CLI (only when executed directly) ────────────────────────────────

if (import.meta.path === Bun.main) {
  const { default: meow } = await import("meow");
  const { default: ora } = await import("ora");

  const allKeyboards = await app.service("keyboards").find({});
  const keyboardNames = Object.keys(allKeyboards).sort();
  const spin = ora({ discardStdin: false, text: "loading configs..." }).start();
  for (const name of keyboardNames) {
    spin.text = name;
    await Bun.sleep(80);
  }
  spin.succeed(`${keyboardNames.length} keyboards: ${keyboardNames.join(", ")}`);

  const cli = meow(
    `
    Usage
      $ keyboards-firmware <command> [options]

    Commands
      status, s                          Show last CI build results
      get, g     <keyboard>              Download firmware
      flash, f   <keyboard> [side] [-r]  Download and flash firmware
      draw, d    [keyboard]              Draw keymap visualizations
      list, l    [--full]                 List keyboards (--full for config table)
      log [n]                            Show last n events (default 20)

    Options
      --reset, -r   Flash settings reset before firmware (flash only)
      --limit, -n   Number of log entries to show (log only)

    Examples
      $ keyboards-firmware status
      $ keyboards-firmware get totem
      $ keyboards-firmware flash totem left -r
      $ keyboards-firmware draw
      $ keyboards-firmware draw totem
      $ keyboards-firmware log 50
  `,
    {
      importMeta: import.meta,
      flags: {
        reset: {
          type: "boolean",
          shortFlag: "r",
          default: false,
        },
        yes: {
          type: "boolean",
          shortFlag: "y",
          default: false,
        },
        limit: {
          type: "number",
          shortFlag: "n",
          default: 20,
        },
        full: {
          type: "boolean",
          default: false,
        },
      },
    },
  );

  const [cmd, ...rest] = cli.input;

  // ── render helpers ─────────────────────────────────────────────────

  function renderStatus(label: string, wf: any) {
    console.log(`${label}:`);
    if (wf.inProgress) console.log(`  run ${wf.inProgress.id}: in progress`);
    if (wf.completed) {
      console.log(`  run ${wf.completed.id}: ${wf.completed.conclusion}`);
      console.log(wf.completed.jobs);
    } else if (!wf.inProgress) {
      console.log("  no runs found");
    }
  }

  function renderLog(rows: any[]) {
    if (!rows.length) {
      console.log("no events logged yet");
      return;
    }
    for (const r of rows) {
      const parts = [r.timestamp, r.env, r.phase, r.service, r.method];
      if (r.keyboard) parts.push(r.keyboard);
      if (r.side) parts.push(r.side);
      if (r.run_id) parts.push(`run:${r.run_id}`);
      if (r.workflow) parts.push(r.workflow);
      if (r.detail) parts.push(r.detail);
      if (r.error) parts.push(`ERR: ${r.error}`);
      console.log(parts.join("  "));
    }
  }

  // ── dispatch ───────────────────────────────────────────────────────

  switch (cmd) {
    case "status":
    case "s": {
      const statuses = await app.service("firmware").find({});
      const labels = Object.keys(statuses);
      for (let i = 0; i < labels.length; i++) {
        if (i > 0) console.log();
        renderStatus(labels[i], statuses[labels[i]]);
      }
      break;
    }

    case "get":
    case "g": {
      const [keyboard] = rest;
      if (!keyboard) {
        console.log("usage: keyboards-firmware get <keyboard>");
        process.exit(1);
      }
      const result = await app.service("firmware").get(keyboard, {});
      console.log(
        `firmware for ${result.keyboard} downloaded to ${result.cacheDir}`,
      );
      break;
    }

    case "flash":
    case "f": {
      const [keyboard, side] = rest;
      if (!keyboard) {
        console.log("usage: keyboards-firmware flash <keyboard> [side] [-r]\n");
        console.log("keyboards:");
        keyboardNames.forEach((k: string) => console.log(`  ${k}`));
        process.exit(1);
      }
      if (keyboard !== "iris" && !side) {
        console.log(
          `usage: keyboards-firmware flash ${keyboard} <left|right> [-r]`,
        );
        process.exit(1);
      }
      await app
        .service("firmware")
        .create({ keyboard, side, reset: cli.flags.reset, yes: cli.flags.yes });
      break;
    }

    case "draw":
    case "d": {
      const [keyboard] = rest;
      if (keyboard) {
        await app.service("draw").get(keyboard, {});
      } else {
        await app.service("draw").create({}, {});
      }
      break;
    }

    case "list":
    case "l": {
      if (cli.flags.full) {
        console.table(allKeyboards);
      } else {
        for (const name of keyboardNames) {
          const kb = allKeyboards[name];
          console.log(`  ${name}  (${kb.type})`);
        }
      }
      break;
    }

    case "log": {
      const limit = rest[0] ? Number(rest[0]) : cli.flags.limit;
      const rows = await app.service("log").find({ query: { limit } });
      renderLog(rows as any[]);
      break;
    }

    default: {
      cli.showHelp(0);
    }
  }

  app.service("log").close();
}
