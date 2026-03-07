import { join } from "path";
import type { Params } from "@feathersjs/feathers";

export class KeyboardsService {
  private root: string;

  constructor(root: string) {
    this.root = root;
  }

  async find(params: Params) {
    const glob = new Bun.Glob("*.keymap");
    const names: string[] = [];
    for (const file of glob.scanSync(join(this.root, "config"))) {
      names.push(file.replace(/\.keymap$/, ""));
    }
    return names.sort();
  }
}
