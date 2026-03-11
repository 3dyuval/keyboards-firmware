import { z } from "zod";
import type { ZodType } from "zod";

// ── service event tuple [stage, message, value] ─────────────────────
// Services yield 3-tuples. The value slot carries typed domain data
// that React consumers pattern-match with ts-pattern.

export type ServiceEvent<T = unknown> = [stage: string, message: string, value: T];

// ── domain value types (extend per module) ──────────────────────────

export type DateValue = { type: "date"; value: Date };
export type StaleValue<T> = { type: "stale"; value: T };
export type DoneValue<T> = { type: "done"; value: T };

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
