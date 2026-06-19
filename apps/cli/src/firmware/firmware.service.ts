import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type { Id, Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";
import { github } from "./gh.ts";
import * as hw from "./hw.ts";

/** Find a firmware file by artifact name, checking .uf2/.bin/.hex extensions. */
function findFirmwareFile(dir: string, artifact: string): string | null {
  const base = join(dir, artifact);
  for (const ext of [".uf2", ".bin", ".hex"]) {
    const p = base + ext;
    if (existsSync(p)) return p;
  }
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir).filter(f => f.startsWith(artifact) && /\.(uf2|bin|hex)$/.test(f));
  return entries.length > 0 ? join(dir, entries[0]) : null;
}

// ── status types ────────────────────────────────────────────────────

export interface BuildJob {
  name: string;
  conclusion: string | null;
}

export interface BuildRun {
  id: number;
  created_at: Date;
  conclusion?: string | null;
  jobs?: BuildJob[];
}

export interface KeyboardStatus {
  workflow: string;
  inProgress: BuildRun | null;
  completed: BuildRun | null;
}

export type StatusMap = Record<string, KeyboardStatus>;

export default class FirmwareService extends BaseService {
  schema = FirmwareCreateSchema;

  // find — CI status for all keyboards (stale-while-revalidate)
  async *find(params: Params): AsyncGenerator<ServiceEvent<StatusMap>> {
    const { keyboards } = params as any;
    const gh = github(this.app);

    const cached = this.app.get("_statusCache") as StatusMap | undefined;
    if (cached) yield ["status", "cached", cached];

    const results: StatusMap = {};
    const fetched: Record<string, KeyboardStatus> = {};
    for (const [name, config] of Object.entries(keyboards) as [string, any][]) {
      if (!fetched[config.workflow]) {
        fetched[config.workflow] = await gh.status(config.workflow);
      }
      const workflowStatus = fetched[config.workflow];
      const jobs = workflowStatus.completed?.jobs?.filter((j) => {
        if (config.type === "qmk") {
          return j.name.includes(config.artifact);
        }
        const lastArtifact = j.name.match(/,\s*([\w-]+)\)$/)?.[1];
        return lastArtifact === `${config.artifact}-left` || lastArtifact === `${config.artifact}-right`;
      });
      results[name] = {
        ...workflowStatus,
        completed: workflowStatus.completed ? { ...workflowStatus.completed, jobs } : null,
      };
      yield ["status", `fetched ${name}`, { ...results }];
    }

    this.app.set("_statusCache", results);
  }

  // get — CI status for one keyboard (stale-while-revalidate)
  async *get(id: Id, params: Params): AsyncGenerator<ServiceEvent<KeyboardStatus>> {
    const { keyboardConfig, keyboard } = params as any;
    const gh = github(this.app);

    const cached = (this.app.get("_statusCache") as StatusMap)?.[keyboard];
    if (cached) yield ["status", "cached", cached];

    const fresh = await gh.status(keyboardConfig.workflow);
    this.app.set("_statusCache", { ...this.app.get("_statusCache"), [keyboard]: fresh });
    yield ["status", keyboard, fresh];
  }

     private async *download(params: Params): AsyncGenerator<ServiceEvent> {
    const { keyboardConfig, artifactName, runId, cacheDir, _cached, keyboard } = params as any;
    const gh = github(this.app);

    if (_cached) {
      yield ["cached", `run ${runId} already cached`, { artifactName, runId }];
      return;
    }

    yield ["downloading", `downloading ${artifactName} from run ${runId}...`, undefined];
    const side = keyboardConfig.type === "zmk"
      ? artifactName.match(/-(?:left|right)$/)?.[0]?.slice(1)
      : undefined;
    await gh.downloadArtifact(runId, keyboardConfig.artifact, cacheDir, side);
    const dl = findFirmwareFile(cacheDir, artifactName);
    if (!dl) throw new Error(`no firmware file found for "${artifactName}" in ${cacheDir}`);
    (params as any).artifactPath = dl;
    yield ["downloaded", "download complete", { artifactName, runId }];
  }

  // create — download firmware only
  async *create(data: any, params: Params): AsyncGenerator<ServiceEvent> {
    if ((params as any).needsGitHub) yield* this.download(params);
    else yield ["cached", `using local artifact`, { path: (params as any).artifactPath }];
  }

  // patch — resolve path, download if needed, flash
  async *patch(id: Id, data: any, params: Params): AsyncGenerator<ServiceEvent> {
    const { artifactName, keyboardConfig, flashConfig } = params as any;
    const { reset, yes } = data;

    if ((params as any).needsGitHub) yield* this.download(params);

    const artifactPath = (params as any).artifactPath;
    if (!artifactPath) throw new Error(`could not resolve artifact path for "${artifactName}"`);

    const buildDir = this.app.get("buildDir") as string;
    const keyboardName = (params as any).keyboard ?? artifactName;

    // Resolve reset file path for keyboards that support it
    let resetFile: string | undefined;
    if (reset && keyboardConfig?.type === "zmk") {
      const resetName = keyboardName === "totem" ? "settings-reset-xiao"
        : keyboardName === "eyelash" ? "settings-reset-eyelash"
        : "settings-reset-nano";
      const candidate = findFirmwareFile(join(buildDir, "local"), resetName);
      if (candidate) resetFile = candidate;
    }

    // Dispatch to flash method based on config
    if (flashConfig.method === "dfu") {
      if (!flashConfig.device) throw new Error(`flash config for "${keyboardName}" missing device (vid:pid)`);
      if (!flashConfig.address) throw new Error(`flash config for "${keyboardName}" missing address`);
      for await (const event of hw.flashDfu(artifactPath, flashConfig.device, flashConfig.address, keyboardName)) {
        yield event;
      }
      yield ["done", "flashed", { artifactName, method: "dfu" }];
      return;
    }

    if (flashConfig.method === "mass-storage") {
      const labels = flashConfig.label ?? flashConfig.labels;
      // RP2040 auto-resets on .uf2 copy — use rename trick
      // nRF52840 Feather does NOT auto-reset — copy directly
      const autoReset = flashConfig.preset !== "feather-nrf52840";
      for await (const event of hw.flashMassStorage(artifactPath, labels, keyboardName, resetFile, autoReset)) {
        yield event;
      }
      yield ["done", "flashed", { artifactName, method: "mass-storage" }];
      return;
    }

    throw new Error(`unsupported flash method "${flashConfig.method}" for keyboard "${keyboardName}"`);
  }
}
