import { feathers } from "@feathersjs/feathers";
import type { Application } from "@feathersjs/feathers";
import { join } from "path";
import type { ZodType } from "zod";

// ── suppress debug logs in production ────────────────────────────────
if (process.env.NODE_ENV !== "development") {
  console.debug = () => {};
}

// ── base service ─────────────────────────────────────────────────────

export abstract class BaseService {
  app: Application;
  schema?: ZodType;

  constructor(app: Application) {
    this.app = app;
  }
}

// ── app ──────────────────────────────────────────────────────────────

// node-config reads NODE_CONFIG_DIR at require() time — set before dynamic import
process.env.NODE_CONFIG_DIR ??= join(import.meta.dir, "..", "config");
const { default: configuration } = await import("@feathersjs/configuration");

import { configValidator } from "../lib/config.schema.ts";

const app = feathers().configure(configuration(configValidator));

export { app };
export type App = typeof app;
