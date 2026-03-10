import type { Application, Id, Params } from "@feathersjs/feathers";

export class KeyboardsService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: Params) {
    return this.app.get("keyboards") as Record<string, any>;
  }

  async get(id: Id, params: Params) {
    const keyboards = this.app.get("keyboards") as Record<string, any>;
    const config = keyboards[id as string];
    if (!config) throw new Error(`unknown keyboard: ${id}`);
    return { name: id, ...config };
  }
}
