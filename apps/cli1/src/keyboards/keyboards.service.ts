import type { Params } from "@feathersjs/feathers";
import { BaseService } from "../base-service.ts";
import { KeyboardSchema, type Keyboard } from "./keyboards.schema.ts";

export default class KeyboardsService extends BaseService {
  schema = KeyboardSchema;

  async find(params: Params) {
    return this.app.get("keyboards") as Record<string, Keyboard>;
  }
}
