import type { Params } from "@feathersjs/feathers";
import { BaseService } from "../app.ts";

export default class ConfigService extends BaseService {
  async find(params?: Params) {
    return {
      root: this.app.get("root"),
      cacheDir: this.app.get("cacheDir"),
      draw: this.app.get("draw"),
      github: this.app.get("github"),
      keyboards: this.app.get("keyboards"),
      logging: this.app.get("logging"),
    };
  }
}
