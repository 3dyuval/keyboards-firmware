import { z } from "zod";
import type { ZodType } from "zod";

// ── service event (yielded by async generator services) ─────────────

export interface ServiceEvent {
  stage: string;
  message?: string;
  stale?: boolean;
  data?: any;
}

// ── MCP tool definition ─────────────────────────────────────────────

export interface McpToolDef {
  tool: string;
  description: string;
  resolves: string;
  schema?: ZodType;
}

// ── reusable schema fields ──────────────────────────────────────────

export const keyboardField = z
  .string()
  .meta({ description: "Keyboard name" });
