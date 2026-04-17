import { join } from "path";
import type { Id, Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";
import { github } from "./gh.ts";
import * as hw from "./hw.ts";

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
    const { keyboardConfig, artifactName, runId, cacheDir, _cached } = params as any;
    const gh = github(this.app);

    if (_cached) {
      yield ["cached", `run ${runId} already cached`, { artifactName, runId }];
      return;
    }

    yield ["downloading", `downloading ${artifactName} from run ${runId}...`, undefined];
    const side = artifactName.match(/-(?:left|right)$/)?.[0]?.slice(1);
    await gh.downloadArtifact(runId, keyboardConfig.artifact, cacheDir, side);
    // move downloaded file to flat ci path
    const dl = join(cacheDir, `${artifactName}.uf2`);
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
    const { artifactName, keyboardConfig } = params as any;
    const { reset, yes } = data;

    if ((params as any).needsGitHub) yield* this.download(params);

    const artifactPath = (params as any).artifactPath;
    if (!artifactPath) throw new Error(`could not resolve artifact path for "${artifactName}"`);

    const side = artifactName.match(/-(?:left|right)$/)?.[0]?.slice(1);
    const keyboard = artifactName.replace(/-(?:left|right)$/, "");

    if (keyboardConfig?.type === "qmk") {
      for await (const event of hw.flashQmk(artifactPath)) yield event;
      yield ["done", "flashed", { artifactName }];
      return;
    }

    if (!side) throw new Error(`cannot determine side from artifact name "${artifactName}"`);

    const buildDir = this.app.get("buildDir") as string;
    for await (const event of hw.flashZmk(keyboard, side, artifactPath, reset ?? false, buildDir, yes ?? false)) {
      yield event;
    }
    yield ["done", "flashed", { artifactName, side, reset }];
  }
}
