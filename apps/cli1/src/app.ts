import { feathers } from "@feathersjs/feathers";
import configuration from "@feathersjs/configuration";

// ── suppress debug logs in production ────────────────────────────────
if (process.env.NODE_ENV !== "development") {
  console.debug = () => {};
}

// ── app ──────────────────────────────────────────────────────────────

const app = feathers().configure(configuration());

export { app };
export type App = typeof app;
