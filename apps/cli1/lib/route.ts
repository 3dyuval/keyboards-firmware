import { parseArgs as nodeParseArgs } from "util";
import type { FC } from "react";
import type { ZodObject } from "zod";
import { z } from "zod";

// ── types ───────────────────────────────────────────────────────────

export interface RouteArg {
  name: string;
  required?: boolean;
}

export interface RouteDef {
  aliases?: string[];
  description?: string;
  args?: RouteArg[];
  schema?: ZodObject<any>;
  component: FC<any>;
}

export interface Route extends RouteDef {
  command: string;
  description: string;
}

// ── schema introspection ────────────────────────────────────────────

export interface FlagDef {
  type: "boolean" | "string";
  alias?: string;
  description?: string;
  enum?: string[];
  required: boolean;
}

function unwrapToBase(value: z.ZodTypeAny): z.ZodTypeAny {
  if (
    value instanceof z.ZodOptional ||
    value instanceof z.ZodNullable ||
    value instanceof z.ZodDefault
  ) {
    return unwrapToBase(value.unwrap() as z.ZodTypeAny);
  }
  return value;
}

function isOptionalOrDefaulted(field: z.ZodTypeAny): boolean {
  if (field instanceof z.ZodOptional || field instanceof z.ZodDefault) return true;
  if (field instanceof z.ZodNullable)
    return isOptionalOrDefaulted(field.unwrap() as z.ZodTypeAny);
  return false;
}

export function flagsFromSchema(
  schema?: ZodObject<any>,
  skip: string[] = [],
): Record<string, FlagDef> {
  if (!schema) return {};
  const skipSet = new Set(skip);
  const result: Record<string, FlagDef> = {};

  for (const [key, value] of Object.entries(schema.shape)) {
    if (skipSet.has(key)) continue;
    const field = value as z.ZodTypeAny;
    const meta = (z.globalRegistry.get(field) ?? {}) as Record<string, any>;
    const base = unwrapToBase(field);
    const required = !isOptionalOrDefaulted(field);

    if (base instanceof z.ZodBoolean) {
      result[key] = { type: "boolean", required, ...meta };
    } else if (base instanceof z.ZodString) {
      result[key] = { type: "string", required, ...meta };
    } else if (base instanceof z.ZodEnum) {
      result[key] = {
        type: "string",
        required,
        ...meta,
        enum: base.options as string[],
      };
    }
  }
  return result;
}

// ── traversal ───────────────────────────────────────────────────────

function* iterRoutes(
  services: Record<string, any>,
): Generator<{ route: Route; service: any }> {
  for (const service of Object.values(services)) {
    const routes = (service as any).expose?.cli as Route[] | undefined;
    if (!routes) continue;
    for (const route of routes) yield { route, service };
  }
}

export const allRoutes = (services: Record<string, any>): Route[] =>
  [...iterRoutes(services)].map((r) => r.route);

export const resolveCommand = (
  services: Record<string, any>,
  command?: string,
) => {
  for (const match of iterRoutes(services)) {
    if (
      match.route.command === command ||
      match.route.aliases?.includes(command ?? "")
    )
      return match;
  }
  return null;
};

// ── arg parsing (transitional — remove once buildCommand/Commander is wired) ─

export function parseArgs(
  argv: string[],
  route: Route,
): Record<string, any> {
  const positionalNames = (route.args ?? []).map((a) => a.name);
  const flags = flagsFromSchema(route.schema, positionalNames);

  const options: Record<string, any> = {};
  for (const [name, flag] of Object.entries(flags)) {
    options[name] = {
      type: flag.type,
      ...(flag.alias && { short: flag.alias }),
    };
  }

  const { values, positionals } = nodeParseArgs({
    args: argv,
    options,
    allowPositionals: true,
    strict: false,
  });

  const result: Record<string, any> = { ...values };
  for (const [i, arg] of (route.args ?? []).entries()) {
    if (positionals[i] !== undefined) {
      result[arg.name] = positionals[i];
    } else if (arg.required) {
      throw new Error(`Missing required argument: <${arg.name}>`);
    }
  }

  if (route.schema) return route.schema.parse(result);
  return result;
}

export function routeUsage(route: Route): string {
  const positionalNames = (route.args ?? []).map((a) => a.name);
  const flags = flagsFromSchema(route.schema, positionalNames);
  const args = (route.args ?? [])
    .map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
    .join(" ");
  const flagStr = Object.entries(flags)
    .map(([name, f]) => (f.alias ? `-${f.alias}` : `--${name}`))
    .join(" ");
  return `keyb1 ${route.command} ${args} ${flagStr}`.trim();
}
