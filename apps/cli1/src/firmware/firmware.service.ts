import type { Id, Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";
import { FirmwareCreateSchema } from "./firmware.schema.ts";
import { github } from "./gh.ts";
import * as hw from "./hw.ts";

export interface ProgressEvent {
  stage: string;
  message?: string;
  stale?: boolean;
  data?: any;
}

export default class FirmwareService extends BaseService {
  schema = FirmwareCreateSchema;

  // find — CI status for all workflows (stale-while-revalidate)
  async *find(params: Params): AsyncGenerator<ProgressEvent> {
    const { workflows } = params as any;
    const gh = github(this.app);

    // yield cached/stale results immediately from last known state
    const cached = this.app.get("_statusCache") as Record<string, any> | undefined;
    if (cached) {
      yield { stage: "status", stale: true, data: cached };
    }

    // fetch fresh from GitHub
    const results: Record<string, any> = {};
    for (const wf of workflows) {
      const label = wf.replace("build-", "").replace(".yml", "");
      results[label] = await gh.status(wf);
      // yield progressively as each workflow resolves
      yield { stage: "status", stale: false, data: { ...results } };
    }

    // cache for next call
    this.app.set("_statusCache", results);
  }

  // get — CI status for one keyboard (stale-while-revalidate)
  async *get(id: Id, params: Params): AsyncGenerator<ProgressEvent> {
    const { keyboardConfig, keyboard } = params as any;
    const gh = github(this.app);
    const cacheKey = `_status_${keyboard}`;

    const cached = this.app.get(cacheKey);
    if (cached) {
      yield { stage: "status", stale: true, data: cached };
    }

    const fresh = await gh.status(keyboardConfig.workflow);
    this.app.set(cacheKey, fresh);
    yield { stage: "status", stale: false, data: fresh };
  }

  private async *download(params: Params): AsyncGenerator<ProgressEvent> {
    const { keyboardConfig, keyboard, runId, cacheDir } = params as any;
    const gh = github(this.app);

    if ((params as any)._cached) {
      yield { stage: "cached", message: `run ${runId} already cached`, data: { keyboard, runId, cached: true, cacheDir } };
      return;
    }

    yield { stage: "downloading", message: `downloading run ${runId}...` };
    await gh.downloadArtifact(runId, keyboardConfig.artifact, cacheDir);
    yield { stage: "downloaded", message: "download complete", data: { keyboard, runId, cached: false, cacheDir } };
  }

  // create — download firmware with progress stages
  async *create(data: any, params: Params): AsyncGenerator<ProgressEvent> {
    yield* this.download(params);
  }

  // patch — download + flash with full stage progression
  async *patch(id: Id, data: any, params: Params): AsyncGenerator<ProgressEvent> {
    const { keyboardConfig, cacheDir, keyboard } = params as any;
    const { side, reset, yes } = data;

    // download phase
    yield* this.download(params);

    // flash phase
    if (keyboardConfig.type === "qmk") {
      for await (const event of hw.flashQmk(cacheDir)) {
        yield event;
      }
      yield { stage: "done", data: { keyboard, firmware: "qmk" } };
      return;
    }

    if (!side) throw new Error(`side required for ${keyboard}`);

    for await (const event of hw.flashZmk(keyboard, side, reset ?? false, cacheDir, yes ?? false)) {
      yield event;
    }
    yield { stage: "done", data: { keyboard, side, reset } };
  }
}
