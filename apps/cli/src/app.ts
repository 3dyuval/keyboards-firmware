import { feathers } from "@feathersjs/feathers";
import type { Application, HookContext } from "@feathersjs/feathers";
import { join } from "path";
import type { ZodType } from "zod";
import type { AppSettings } from "../types.d.ts";

// ── suppress debug logs in production ────────────────────────────────
if (process.env.NODE_ENV !== "development") {
  console.debug = () => {};
}

// ── base service ─────────────────────────────────────────────────────

export type App = Application<any, AppSettings>;
export type Hook = HookContext<App>;

export abstract class BaseService {
  app: App;
  schema?: ZodType;

  constructor(app: App) {
    this.app = app;
  }
}

// ── app ──────────────────────────────────────────────────────────────

// node-config reads NODE_CONFIG_DIR at require() time — set before dynamic import
process.env.NODE_CONFIG_DIR ??= join(import.meta.dir, "..", "config");

// Resolve git root for config (was previously done via Bun.spawnSync in default.ts)
if (!process.env.GIT_ROOT) {
  try {
    process.env.GIT_ROOT = require("child_process").execSync("git rev-parse --show-toplevel", { encoding: "utf-8" }).trim();
  } catch {
    process.env.GIT_ROOT = ".";
  }
}

const { default: configuration } = await import("@feathersjs/configuration");

import { configValidator } from "../lib/config.schema.ts";

const app: App = feathers<any, AppSettings>().configure(
  configuration(configValidator),
);

// Override root with actual git root (default.json uses placeholder)
app.set("root", process.env.GIT_ROOT || ".");

export { app };
