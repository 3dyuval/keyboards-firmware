import type { Application, Id, Params } from "@feathersjs/feathers";
import * as gh from "./gh.ts";
import * as hw from "./hardware.ts";

export class FirmwareService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: Params) {
    const { github: { owner, repo }, workflows } = params as any;
    const results: Record<string, any> = {};
    for (const wf of workflows) {
      const label = wf.replace("build-", "").replace(".yml", "");
      results[label] = await gh.status(owner, repo, wf);
    }
    return results;
  }

  async get(id: Id, params: Params) {
    const { github: { owner, repo }, keyboardConfig, keyboard, runId, cacheDir } = params as any;
    await gh.downloadArtifact(owner, repo, runId, keyboardConfig.artifact, cacheDir);
    return { keyboard, runId, workflow: keyboardConfig.workflow, artifact: keyboardConfig.artifact, cached: false, cacheDir };
  }

  async create(data: { keyboard: string; side?: string; reset?: boolean; yes?: boolean }, params: Params) {
    const { keyboardConfig, cacheDir } = params as any;
    const { side, reset, yes } = data;

    const downloaded = await this.app.service("firmware").get(data.keyboard, params ?? {});

    if (keyboardConfig.type === "qmk") {
      return { ...downloaded, ...await hw.flashQmk(cacheDir) };
    }
    if (!side) throw new Error(`side required for ${data.keyboard}`);
    return { ...downloaded, ...await hw.flashZmk(data.keyboard, side, reset ?? false, cacheDir, yes ?? false) };
  }
}
