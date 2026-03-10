import type { Application } from "@feathersjs/feathers";
import { readdir } from "fs/promises";
import { join } from "path";

interface DiscoveredService {
  path: string;
  dir: string;
  base: string;
  serviceFile: string;
  hooksFile?: string;
  cliFile?: string;
  mcpFile?: string;
}

export interface RegistrationEvent {
  phase: "registered" | "hooked";
  path: string;
}

function toServicePath(folderName: string): string {
  return folderName.replace(/\._id\./g, "/:id/");
}

function serviceBaseName(folderName: string): string {
  const parts = folderName.split(".");
  return parts[parts.length - 1];
}

async function* scan(srcDir: string): AsyncGenerator<DiscoveredService> {
  const entries = await readdir(srcDir, { withFileTypes: true });

  for (const entry of entries.filter((e) => e.isDirectory())) {
    const folderPath = join(srcDir, entry.name);
    const files = await readdir(folderPath);
    const base = serviceBaseName(entry.name);

    const serviceFile = files.find((f) => f === `${base}.service.ts`);
    if (!serviceFile) continue;

    yield {
      path: toServicePath(entry.name),
      dir: folderPath,
      base,
      serviceFile: join(folderPath, serviceFile),
      hooksFile: files.includes(`${base}.hooks.ts`)
        ? join(folderPath, `${base}.hooks.ts`)
        : undefined,
      cliFile: files.includes(`${base}.cli.tsx`)
        ? join(folderPath, `${base}.cli.tsx`)
        : undefined,
      mcpFile: files.includes(`${base}.mcp.ts`)
        ? join(folderPath, `${base}.mcp.ts`)
        : undefined,
    };
  }
}

export async function* registerServices(
  app: Application,
  srcDir: string,
): AsyncGenerator<RegistrationEvent> {
  const discovered = await Array.fromAsync(scan(srcDir));
  const resolvedPaths = new Map<DiscoveredService, string>();

  // Pass 1 — register services, build expose from filesystem
  for (const svc of discovered) {
    let mod: any;
    try {
      mod = await import(svc.serviceFile);
    } catch (err) {
      console.debug(`Failed to import service ${svc.serviceFile}:`, err);
      continue;
    }

    const ServiceClass = mod.default;
    if (!ServiceClass || typeof ServiceClass !== "function") {
      console.debug(`No default export in ${svc.serviceFile}, skipping`);
      continue;
    }
    const instance = new ServiceClass(app);

    // Build expose from what files exist
    const expose: Record<string, any> = {};

    if (svc.cliFile) {
      try {
        const cliMod = await import(svc.cliFile);
        const component =
          cliMod.default ??
          Object.values(cliMod).find((v: any) => typeof v === "function");
        expose.cli = {
          command: cliMod.command ?? svc.base,
          description: cliMod.description ?? "",
          component,
        };
      } catch (err) {
        console.debug(`Failed to import CLI module ${svc.cliFile}:`, err);
      }
    }

    if (svc.mcpFile) {
      try {
        const mcpMod = await import(svc.mcpFile);
        expose.mcp = mcpMod.default ?? mcpMod;
      } catch (err) {
        console.debug(`Failed to import MCP module ${svc.mcpFile}:`, err);
      }
    }

    instance.expose = expose;

    const path = instance.path ?? svc.path;
    app.use(path, instance);
    resolvedPaths.set(svc, path);
    yield { phase: "registered", path };
  }

  // Pass 2 — wire hooks (all services available)
  for (const svc of discovered) {
    if (!svc.hooksFile) continue;
    const path = resolvedPaths.get(svc);
    if (!path) continue;
    try {
      const hooksMod = await import(svc.hooksFile);
      app.service(path).hooks(hooksMod.default ?? hooksMod);
      yield { phase: "hooked", path };
    } catch (err) {
      console.debug(`Failed to import hooks ${svc.hooksFile}:`, err);
    }
  }
}
