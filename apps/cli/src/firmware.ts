import type { Application, Id, Params } from "@feathersjs/feathers";
import * as gh from "./gh.ts";

export class FirmwareService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  // GET /keyboards/:keyboardId/firmware — check cache status
  async get(id: Id, params: Params) {
    const { keyboard, cacheDir, cached, runId, keyboardConfig } = params as any;
    return {
      keyboard,
      runId,
      workflow: keyboardConfig.workflow,
      artifact: keyboardConfig.artifact,
      cached: cached ?? false,
      cacheDir,
    };
  }

  // POST /keyboards/:keyboardId/firmware — download/cache firmware
  async create(data: any, params: Params) {
    const { github: { owner, repo }, keyboardConfig, keyboard, runId, cacheDir } = params as any;
    await gh.downloadArtifact(owner, repo, runId, keyboardConfig.artifact, cacheDir);
    return {
      keyboard,
      runId,
      workflow: keyboardConfig.workflow,
      artifact: keyboardConfig.artifact,
      cached: false,
      cacheDir,
    };
  }
}
