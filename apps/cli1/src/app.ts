import { feathers } from "@feathersjs/feathers";
import type { Application } from "@feathersjs/feathers";
import configuration from "@feathersjs/configuration";
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

const app = feathers().configure(configuration());

export { app };
export type App = typeof app;
