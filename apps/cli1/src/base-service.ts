import type { Application } from "@feathersjs/feathers";
import type { ZodType } from "zod";

export abstract class BaseService {
  app: Application;
  schema?: ZodType;

  constructor(app: Application) {
    this.app = app;
  }
}
