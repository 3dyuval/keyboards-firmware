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
const { default: configuration } = await import("@feathersjs/configuration");

import { configValidator } from "../lib/config.schema.ts";

const app: App = feathers<any, AppSettings>().configure(
  configuration(configValidator),
);

export { app };
