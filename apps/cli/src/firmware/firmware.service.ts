import type { Id, Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";
import { github } from "./gh.ts";
import * as hw from "./hw.ts";
import * as remoteSource from "./sources/remote.ts";
import * as localSource from "./sources/local.ts";

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
    if (cached) {
      yield ["status", "cached", cached];
    }

    const results: StatusMap = {};
    const fetched: Record<string, KeyboardStatus> = {};
    for (const [name, config] of Object.entries(keyboards) as [string, any][]) {
      const workflow = config.remote?.workflow ?? config.workflow;
      if (!workflow) continue;
      if (!fetched[workflow]) {
        fetched[workflow] = await gh.status(workflow);
      }
      const workflowStatus = fetched[workflow];
      const artifact = config.remote?.artifact ?? config.artifact ?? name;
      const jobs = workflowStatus.completed?.jobs?.filter((j) => {
        const lastArtifact = j.name.match(/,\s*([\w-]+)\)$/)?.[1];
        return (
          lastArtifact === `${artifact}-left` ||
          lastArtifact === `${artifact}-right`
        );
      });
      results[name] = {
        ...workflowStatus,
        completed: workflowStatus.completed
          ? { ...workflowStatus.completed, jobs }
          : null,
      };
      yield ["status", `fetched ${name}`, { ...results }];
    }

    this.app.set("_statusCache", results);
  }

  // get — CI status for one keyboard (stale-while-revalidate)
  async *get(id: Id, params: Params): AsyncGenerator<ServiceEvent<KeyboardStatus>> {
    const { keyboardConfig, keyboard } = params as any;
    const gh = github(this.app);
    const workflow = keyboardConfig.remote?.workflow ?? keyboardConfig.workflow;

    const cached = (this.app.get("_statusCache") as StatusMap)?.[keyboard];
    if (cached) {
      yield ["status", "cached", cached];
    }

    const fresh = await gh.status(workflow);
    this.app.set("_statusCache", {
      ...this.app.get("_statusCache"),
      [keyboard]: fresh,
    });
    yield ["status", keyboard, fresh];
  }

  // create — download firmware only (pre-cache)
  async *create(data: any, params: Params): AsyncGenerator<ServiceEvent> {
    const { keyboardConfig, keyboard, source, cached, cacheDir } = params as any;
    const artifact = keyboardConfig.remote?.artifact ?? keyboardConfig.artifact;
    yield* remoteSource.acquire(this.app, {
      runId: source.runId,
      cached: cached ?? false,
      keyboard,
      artifact,
      cacheDir,
      side: data?.side,
    });
  }

  // patch — acquire from source + flash
  async *patch(id: Id, data: any, params: Params): AsyncGenerator<ServiceEvent> {
    const { keyboardConfig, keyboard, source, cached, cacheDir } = params as any;
    const { side, reset, yes } = data;

    if (source.kind === "remote") {
      const artifact = keyboardConfig.remote?.artifact ?? keyboardConfig.artifact;
      yield* remoteSource.acquire(this.app, {
        runId: source.runId,
        cached: cached ?? false,
        keyboard,
        artifact,
        cacheDir,
        side,
      });
    } else {
      yield* localSource.acquire(this.app, {
        keyboard,
        local: keyboardConfig.local,
        type: keyboardConfig.type,
        cacheDir,
        side,
      });
    }

    if (keyboardConfig.type === "qmk") {
      for await (const event of hw.flashQmk(cacheDir)) {
        yield event;
      }
      yield ["done", "flashed", { keyboard, firmware: "qmk" }];
      return;
    }

    if (!side) throw new Error(`side required for ${keyboard}`);

    for await (const event of hw.flashZmk(keyboard, side, reset ?? false, cacheDir, yes ?? false)) {
      yield event;
    }
    yield ["done", "flashed", { keyboard, side, reset }];
  }
}
