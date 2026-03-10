import type { Config } from "./lib/config.schema.ts";
import type { Parser } from "web-tree-sitter";
import type { Octokit } from "octokit";

/**
 * App settings = config (from Zod) + runtime additions.
 * Typed via Feathers' Application<Services, Settings> generic.
 */
export type AppSettings = Config & {
  /** GitHub auth token (from env or local config) */
  githubAuthToken?: string;

  // ── cached singletons ───────────────────────────────────────────

  /** Tree-sitter C parser (lazy-init by parse hooks) */
  "c-parser"?: Parser;

  /** Octokit instance (lazy-init by gh.ts) */
  _octokit?: Octokit;

  /** Cached CI status for all workflows */
  _statusCache?: Record<string, any>;
};
