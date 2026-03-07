import type { Application, Id, Params } from "@feathersjs/feathers";
import * as gh from "./gh.ts";
import * as hw from "./hardware.ts";

interface KeyboardConfig {
  workflow: string;
  artifact: string;
  type: "zmk" | "qmk";
}

export class FirmwareService {
  private cacheDir: string;
  private app: Application;

  constructor(cacheDir: string, app: Application) {
    this.cacheDir = cacheDir;
    this.app = app;
  }

  private github() {
    return this.app.get("github") as { owner: string; repo: string };
  }

  private keyboardConfig(keyboard: string): KeyboardConfig {
    const keyboards = this.app.get("keyboards") as Record<string, KeyboardConfig>;
    if (!keyboards[keyboard]) throw new Error(`unknown keyboard "${keyboard}" — not in config`);
    return keyboards[keyboard];
  }

  private workflows(): string[] {
    const keyboards = this.app.get("keyboards") as Record<string, KeyboardConfig>;
    return [...new Set(Object.values(keyboards).map((k) => k.workflow))];
  }

  // GET /firmware — CI build status for all workflows
  async find(params: Params) {
    const { owner, repo } = this.github();
    const results: Record<string, any> = {};
    for (const wf of this.workflows()) {
      const label = wf.replace("build-", "").replace(".yml", "");
      results[label] = await gh.status(owner, repo, wf);
    }
    return results;
  }

  // GET /firmware/:keyboard — download firmware artifact
  async get(keyboard: Id, params: Params) {
    const kb = String(keyboard);
    const { owner, repo } = this.github();
    const { workflow, artifact } = this.keyboardConfig(kb);
    const { runId, cached } = await gh.downloadArtifact(owner, repo, workflow, artifact, this.cacheDir);
    return { keyboard: kb, runId, workflow, artifact, cached, cacheDir: this.cacheDir };
  }

  // POST /firmware — download + flash to hardware
  async create(data: { keyboard: string; side?: string; reset?: boolean; yes?: boolean }, params: Params) {
    const { keyboard, side, reset, yes } = data;
    const { type } = this.keyboardConfig(keyboard);

    const downloaded = await this.get(keyboard, params ?? {});

    if (type === "qmk") {
      return { ...downloaded, ...await hw.flashQmk(this.cacheDir) };
    }
    if (!side) throw new Error(`side required for ${keyboard}`);
    return { ...downloaded, ...await hw.flashZmk(keyboard, side, reset ?? false, this.cacheDir, yes ?? false) };
  }
}
