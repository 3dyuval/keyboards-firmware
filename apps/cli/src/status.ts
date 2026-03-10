import type { Application, Id, Params } from "@feathersjs/feathers";
import * as gh from "./gh.ts";

export class StatusService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  // GET /keyboards/:keyboardId/status
  async get(id: Id, params: Params) {
    const { github: { owner, repo }, keyboardConfig } = params as any;
    return gh.status(owner, repo, keyboardConfig.workflow);
  }

  // GET /keyboards/status (all)
  async find(params: Params) {
    const { github: { owner, repo }, workflows } = params as any;
    const results: Record<string, any> = {};
    for (const wf of workflows) {
      const label = wf.replace("build-", "").replace(".yml", "");
      results[label] = await gh.status(owner, repo, wf);
    }
    return results;
  }
}
