import { github } from "../gh.ts";
import type { App } from "../../app.ts";
import type { ServiceEvent } from "../../../lib/types.ts";

export async function* acquire(
  app: App,
  {
    runId,
    cached,
    keyboard,
    artifact,
    cacheDir,
    side,
  }: {
    runId: string;
    cached: boolean;
    keyboard: string;
    artifact: string;
    cacheDir: string;
    side?: string;
  },
): AsyncGenerator<ServiceEvent> {
  if (cached) {
    yield ["cached", `run ${runId} already cached`, { keyboard, runId, cacheDir }];
    return;
  }
  yield ["downloading", `downloading run ${runId}...`, undefined];
  await github(app).downloadArtifact(runId, artifact, cacheDir, side);
  yield ["downloaded", "download complete", { keyboard, runId, cacheDir }];
}
