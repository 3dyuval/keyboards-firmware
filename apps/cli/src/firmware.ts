import type { Application, Id, Params } from "@feathersjs/feathers";
import * as gh from "./gh.ts";
import * as hw from "./hardware.ts";

export class FirmwareService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  // find — CI status for all workflows
  async find(params: Params) {
    const { github: { owner, repo }, workflows } = params as any;
    const results: Record<string, any> = {};
    for (const wf of workflows) {
      const label = wf.replace("build-", "").replace(".yml", "");
      results[label] = await gh.status(owner, repo, wf);
    }
    return results;
  }

  // get — CI status for one keyboard
  async get(id: Id, params: Params) {
    const { github: { owner, repo }, keyboardConfig } = params as any;
    return gh.status(owner, repo, keyboardConfig.workflow);
  }

  // create — download/cache firmware
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

  // patch — download + flash
  async patch(id: Id, data: { side?: string; reset?: boolean; yes?: boolean }, params: Params) {
    const { keyboardConfig, cacheDir, keyboard } = params as any;
    const { side, reset, yes } = data;

    // download first (hooks will cache-check)
    await this.app.service("firmware").create({}, params as any);

    if (keyboardConfig.type === "qmk") {
      return { ...await hw.flashQmk(cacheDir), keyboard };
    }
    if (!side) throw new Error(`side required for ${keyboard}`);
    return { ...await hw.flashZmk(keyboard, side, reset ?? false, cacheDir, yes ?? false) };
  }
}
