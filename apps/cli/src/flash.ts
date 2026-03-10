import type { Application, Params } from "@feathersjs/feathers";
import * as hw from "./hardware.ts";

export class FlashService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  // POST /keyboards/:keyboardId/flash
  async create(
    data: { side?: string; reset?: boolean; yes?: boolean },
    params: Params,
  ) {
    const { keyboardConfig, cacheDir, keyboard } = params as any;
    const { side, reset, yes } = data;

    // Ensure firmware is downloaded first
    await this.app.service("firmware").create({}, params as any);

    if (keyboardConfig.type === "qmk") {
      return { ...await hw.flashQmk(cacheDir), keyboard };
    }
    if (!side) throw new Error(`side required for ${keyboard}`);
    return { ...await hw.flashZmk(keyboard, side, reset ?? false, cacheDir, yes ?? false) };
  }
}
