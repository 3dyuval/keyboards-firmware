import { join } from "path";
import { readdirSync, existsSync } from "fs";
import { BaseService } from "../app.ts";
import type { ServiceEvent } from "../../lib/types.ts";
export type BuildTarget = "zmk" | "qmk" | "all";

const LOG_LINES = 20;

interface BuildJob {
  status: "running" | "done" | "failed";
  target: BuildTarget;
  log: string[];
  artifacts?: string[];
  error?: string;
}

const jobs = new Map<string, BuildJob>();

async function runBuild(jobId: string, target: BuildTarget, root: string, buildDir: string) {
  const script = join(root, "scripts/docker/build.sh");
  const args = target === "all" ? [] : [target];

  try {
    const proc = Bun.spawn(["bash", script, ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });

    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n").map(l => l.trim()).filter(Boolean);
      const job = jobs.get(jobId)!;
      job.log.push(...lines);
      if (job.log.length > LOG_LINES) job.log = job.log.slice(-LOG_LINES);
    }

    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      const job = jobs.get(jobId)!;
      jobs.set(jobId, { ...job, status: "failed", error: stderr.slice(0, 500) });
      return;
    }

    const artifacts = existsSync(buildDir)
      ? readdirSync(buildDir)
          .filter(f => f.endsWith(".uf2") || f.endsWith(".bin"))
          .map(f => join(buildDir, f))
      : [];

    const job = jobs.get(jobId)!;
    jobs.set(jobId, { ...job, status: "done", artifacts });
  } catch (e: any) {
    const job = jobs.get(jobId)!;
    jobs.set(jobId, { ...job, status: "failed", error: e.message });
  }
}

export default class BuildService extends BaseService {
  async *create(data: { target?: BuildTarget }): AsyncGenerator<ServiceEvent> {
    const target = data?.target ?? "zmk";
    const root = this.app.get("root") as string;
    const buildDir = join(this.app.get("buildDir") as string, "local");
    const jobId = crypto.randomUUID();

    jobs.set(jobId, { status: "running", target, log: [] });
    runBuild(jobId, target, root, buildDir);

    yield ["started", `job ${jobId} queued`, { jobId, target }];
  }

  async get(id: string) {
    const job = jobs.get(id);
    if (!job) throw new Error(`build job "${id}" not found`);
    return { jobId: id, status: job.status, target: job.target, log: job.log, artifacts: job.artifacts, error: job.error };
  }
}
