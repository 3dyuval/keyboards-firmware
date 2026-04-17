import type { Hook } from "../app.ts";

export function checkDocker(context: Hook) {
  if (!Bun.which("docker")) throw new Error("docker not installed — required for local builds");
}

export default {
  before: {
    create: [checkDocker],
  },
};
