import type { Id, Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import type { ServiceEvent } from "../../lib/types.ts";
import { github } from "./gh.ts";
import * as hw from "./hw.ts";

// ── status types ────────────────────────────────────────────────────

export interface BuildRun {
  id: number;
  created_at: Date;
  conclusion?: string | null;
  jobs?: string;
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
      if (!fetched[config.workflow]) {
        fetched[config.workflow] = await gh.status(config.workflow);
      }
      results[name] = fetched[config.workflow];
      yield ["status", `fetched ${name}`, { ...results }];
    }

    this.app.set("_statusCache", results);
  }

  // get — CI status for one keyboard (stale-while-revalidate)
  async *get(id: Id, params: Params): AsyncGenerator<ServiceEvent<KeyboardStatus>> {
    const { keyboardConfig, keyboard } = params as any;
    const gh = github(this.app);

    const cached = (this.app.get("_statusCache") as StatusMap)?.[keyboard];
    if (cached) {
      yield ["status", "cached", cached];
    }

    const fresh = await gh.status(keyboardConfig.workflow);
    this.app.set("_statusCache", {
      ...this.app.get("_statusCache"),
      [keyboard]: fresh,
    });
    yield ["status", keyboard, fresh];
  }

  private async *download(params: Params): AsyncGenerator<ServiceEvent> {
    const { keyboardConfig, keyboard, runId, cacheDir } = params as any;
    const gh = github(this.app);

    if ((params as any)._cached) {
      yield ["cached", `run ${runId} already cached`, { keyboard, runId, cached: true, cacheDir }];
      return;
    }

    yield ["downloading", `downloading run ${runId}...`, undefined];
    await gh.downloadArtifact(runId, keyboardConfig.artifact, cacheDir);
    yield ["downloaded", "download complete", { keyboard, runId, cached: false, cacheDir }];
  }

  // create — download firmware with progress stages
  async *create(data: any, params: Params): AsyncGenerator<ServiceEvent> {
    yield* this.download(params);
  }

  // patch — download + flash with full stage progression
  async *patch(id: Id, data: any, params: Params): AsyncGenerator<ServiceEvent> {
    const { keyboardConfig, cacheDir, keyboard } = params as any;
    const { side, reset, yes } = data;

    yield* this.download(params);

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
