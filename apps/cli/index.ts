#!/usr/bin/env bun
import {
  feathers,
  type HookContext,
  type NextFunction,
} from "@feathersjs/feathers";
import configuration from "@feathersjs/configuration";
import { join } from "path";
import { mkdirSync } from "fs";

import { ParseService } from "./src/parse.ts";
import { parseHooks } from "./src/parse.hooks.ts";
import { DrawService } from "./src/draw.ts";
import { FirmwareService } from "./src/firmware.ts";
import { FlashService } from "./src/flash.ts";
import { StatusService } from "./src/status.ts";
import { firmwareHooks, flashHooks, statusHooks } from "./src/firmware.hooks.ts";
import { KeyboardsService } from "./src/keyboards.ts";
import { resolveKeyboardFromRoute } from "./src/keyboards.hooks.ts";
import { LogService } from "./src/log.ts";
import { createLogHook } from "./src/log.hooks.ts";

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

const app = feathers().configure(configuration());

app.set("cacheDir", CACHE);
app.set("root", ROOT);

app.use("parse", new ParseService(app));
app.use("log", new LogService(DB_PATH, app));
app.use("keyboards", new KeyboardsService(app));
app.use("keyboards/:keyboardId/draw", new DrawService(ROOT, app));
app.use("firmware", new FirmwareService(app));
app.use("flash", new FlashService(app));
app.use("status", new StatusService(app));

app.service("parse").hooks(parseHooks);
app.service("keyboards/:keyboardId/draw").hooks({
  before: { all: [resolveKeyboardFromRoute] },
});
app.service("firmware").hooks(firmwareHooks);
app.service("flash").hooks(flashHooks);
app.service("status").hooks(statusHooks);
app.service("keyboards").hooks({
  after: {
    find: [
      async (context: HookContext) => {
        // Enrich with last flash timestamp from log
        const logService = app.service("log") as any;
        const rows = logService.db.prepare(
          `SELECT json_extract(data, '$.keyboard') as keyboard, MAX(timestamp) as last_flashed
           FROM event_log
           WHERE service = 'flash' AND method = 'create' AND phase = 'after' AND error IS NULL
           GROUP BY keyboard`
        ).all() as { keyboard: string; last_flashed: string }[];

        const lastFlashed: Record<string, string> = {};
        for (const r of rows) lastFlashed[r.keyboard] = r.last_flashed;

        for (const [name, config] of Object.entries(context.result as Record<string, any>)) {
          config.last_flashed = lastFlashed[name] ?? "";
        }
      },
      async (context: HookContext) => {
        if (!context.params.interactive) return;
        const { default: ora } = await import("ora");
        const names = Object.keys(context.result).sort();
        const spin = ora({ discardStdin: false, text: "loading configs..." }).start();
        for (const name of names) {
          spin.text = name;
          await Bun.sleep(80);
        }
        spin.succeed(`${names.length} keyboards: ${names.join(", ")}`);
      },
    ],
  },
});

// ── global event-log hooks ───────────────────────────────────────────

app.hooks({
  before: { all: [createLogHook("before")] },
  after: { all: [createLogHook("after")] },
  error: { all: [createLogHook("error")] },
});

// ── export app for programmatic use ──────────────────────────────────

export { app };

// ── CLI (only when executed directly) ────────────────────────────────

if (import.meta.path === Bun.main) {
  const { default: meow } = await import("meow");
  const { default: ora } = await import("ora");

  const cli = meow(
    `
    Usage
      $ keyb <command> [options]

    Commands
      status, s  [keyboard]              Show CI build status
      get, g     <keyboard>              Download firmware
      flash, f   <keyboard> [side] [-r]  Download and flash firmware
      parse, p   <file>                  Parse keymap.c to JSON
      draw, d    [keyboard]              Draw keymap visualizations
      list, l    [--short]               List keyboards (--short for names only)
      log [n]                            Show last n events (default 20)

    Options
      --reset, -r   Flash settings reset before firmware (flash only)
      --yes, -y     Skip confirmation prompts
      --limit, -n   Number of log entries to show (log only)
      --short       Show short list (list only)

    Examples
      $ keyb status
      $ keyb get totem
      $ keyb flash totem left -r
      $ keyb draw
      $ keyb draw totem
      $ keyb log 50
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
        short: {
          type: "boolean",
          default: false,
        },
      },
    },
  );

  const [cmd, ...rest] = cli.input;
  const interactive = !cmd || ["list", "l", "status", "s", "flash", "f"].includes(cmd);
  const allKeyboards = await app.service("keyboards").find({ interactive } as any) as Record<string, any>;
  const keyboardNames = Object.keys(allKeyboards).sort();

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
      const parts = [r.timestamp, r.phase, r.service, r.method];
      if (r.data) {
        const d = JSON.parse(r.data);
        for (const [k, v] of Object.entries(d)) {
          if (v != null && v !== "") parts.push(`${k}:${v}`);
        }
      }
      if (r.error) parts.push(`ERR: ${r.error}`);
      console.log(parts.join("  "));
    }
  }

  // ── dispatch ───────────────────────────────────────────────────────

  switch (cmd) {
    case "status":
    case "s": {
      const [keyboard] = rest;
      if (keyboard) {
        const result = await app.service("status").get(keyboard, {});
        renderStatus(keyboard, result);
      } else {
        const statuses = await app.service("status").find({});
        const labels = Object.keys(statuses);
        for (let i = 0; i < labels.length; i++) {
          if (i > 0) console.log();
          renderStatus(labels[i], statuses[labels[i]]);
        }
      }
      break;
    }

    case "get":
    case "g": {
      const [keyboard] = rest;
      if (!keyboard) {
        console.log("usage: keyb get <keyboard>");
        process.exit(1);
      }
      const result = await app.service("firmware").create({}, { keyboard } as any);
      console.log(
        `firmware for ${result.keyboard} downloaded to ${result.cacheDir}`,
      );
      break;
    }

    case "flash":
    case "f": {
      const [keyboard, side] = rest;
      if (!keyboard) {
        console.log("usage: keyb flash <keyboard> [side] [-r]\n");
        console.log("keyboards:");
        keyboardNames.forEach((k: string) => console.log(`  ${k}`));
        process.exit(1);
      }
      if (keyboard !== "iris" && !side) {
        console.log(
          `usage: keyb flash ${keyboard} <left|right> [-r]`,
        );
        process.exit(1);
      }
      await app
        .service("flash")
        .create({ side, reset: cli.flags.reset, yes: cli.flags.yes }, { keyboard } as any);
      break;
    }

    case "draw":
    case "d": {
      const [keyboard] = rest;
      const targets = keyboard ? [keyboard] : keyboardNames;
      for (const kb of targets) {
        await app.service("keyboards/:keyboardId/draw").create({}, {
          route: { keyboardId: kb },
        } as any);
      }
      break;
    }

    case "parse":
    case "p": {
      const [file] = rest;
      if (!file) {
        console.log("usage: keyb parse <keymap.c>");
        process.exit(1);
      }
      const filePath = file.startsWith("/") ? file : join(ROOT, file);
      const result = await app.service("parse").create({ file: filePath }, {});
      console.log(JSON.stringify(result, null, 2));
      break;
    }

    case "list":
    case "l": {
      if (cli.flags.short) {
        for (const name of keyboardNames) {
          const kb = allKeyboards[name];
          console.log(`  ${name}  (${kb.type})`);
        }
      } else {
        console.table(allKeyboards);
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

  (app.service("log") as any).close();
}
