import type { HookContext } from "@feathersjs/feathers";

function extractData(context: HookContext): Record<string, any> | undefined {
  const data = context.data ?? {};
  const result = context.result ?? {};
  const params = context.params as any;

  const merged: Record<string, any> = {};

  const keyboard = params.keyboard ?? data.keyboard ?? result.keyboard ?? result.name;
  if (keyboard) merged.keyboard = keyboard;

  const side = data.side ?? result.side;
  if (side) merged.side = side;

  const runId = params.runId ?? result.runId;
  if (runId) merged.runId = runId;

  const cached = result.cached;
  if (cached != null) merged.cached = cached;

  const workflow = data.workflow ?? result.workflow ?? params.query?.workflow;
  if (workflow) merged.workflow = workflow;

  const firmware = result.firmware;
  if (firmware) merged.firmware = firmware;

  const svg = result.svg;
  if (svg) merged.svg = svg;

  const file = data.file;
  if (file) merged.file = file;

  return Object.keys(merged).length ? merged : undefined;
}

export function createLogHook(phase: "before" | "after" | "error") {
  return async (context: HookContext) => {
    if (context.path === "log") return;

    const logging = context.app.get("logging") as Record<string, string[]> | undefined;
    if (!logging) return;

    const methods = logging[context.path];
    if (!methods?.includes(context.method)) return;

    await context.app.service("log").create({
      phase,
      service: context.path,
      method: context.method,
      data: extractData(context),
      error: phase === "error" ? (context.error?.message ?? String(context.error)) : undefined,
    });
  };
}
