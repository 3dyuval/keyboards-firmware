import { Octokit } from "octokit";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import type { App } from "../app.ts";

function octo(app: App): Octokit {
  const cached = app.get("_octokit");
  if (cached) return cached;

  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_AUTH_TOKEN ||
    app.get("githubAuthToken");
  if (!token) {
    throw new Error(
      "Missing GitHub token — set GITHUB_TOKEN env var or githubAuthToken in local.json",
    );
  }

  const instance = new Octokit({ auth: token });
  app.set("_octokit", instance);
  return instance;
}

export function github(app: App) {
  const gh = app.get("github");
  if (!gh) throw new Error("github config required — set owner/repo in config");
  const { owner, repo } = gh;
  const ok = octo(app);

  return {
    async status(workflow: string) {
      const { data: inProgressRuns } =
        await ok.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflow,
          status: "in_progress",
          per_page: 1,
        });

      const { data: completedRuns } =
        await ok.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflow,
          status: "completed",
          per_page: 1,
        });

      const result: any = { workflow, inProgress: null, completed: null };

      if (inProgressRuns.workflow_runs.length) {
        const run = inProgressRuns.workflow_runs[0];
        result.inProgress = { id: run.id, created_at: new Date(run.created_at) };
      }

      if (completedRuns.workflow_runs.length) {
        const run = completedRuns.workflow_runs[0];
        const { data: jobsData } =
          await ok.rest.actions.listJobsForWorkflowRun({
            owner,
            repo,
            run_id: run.id,
          });
        const jobs = jobsData.jobs.map((j) => ({
          name: j.name,
          conclusion: j.conclusion ?? null,
        }));
        result.completed = {
          id: run.id,
          conclusion: run.conclusion,
          jobs,
          created_at: new Date(run.created_at),
        };
      }

      return result;
    },

    async waitAndResolve(workflow: string): Promise<string> {
      const { data: inProgressRuns } =
        await ok.rest.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflow,
          status: "in_progress",
          per_page: 1,
        });

      if (inProgressRuns.workflow_runs.length) {
        const runId = inProgressRuns.workflow_runs[0].id;
        console.debug(`run ${runId} in progress, waiting...`);
        while (true) {
          await Bun.sleep(5000);
          const { data: run } = await ok.rest.actions.getWorkflowRun({
            owner,
            repo,
            run_id: runId,
          });
          if (run.status === "completed") {
            if (run.conclusion !== "success")
              throw new Error(`run ${runId} ${run.conclusion}`);
            console.debug("run completed");
            break;
          }
        }
      }

      const { data: runs } = await ok.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflow,
        status: "completed",
        per_page: 10,
      });

      const successful = runs.workflow_runs.find(
        (r) => r.conclusion === "success",
      );
      if (!successful) throw new Error("no successful build found");
      return String(successful.id);
    },

    async discoverKeyboards(): Promise<Record<string, import("../keyboards/keyboards.schema.ts").Keyboard>> {
      const workflows = [
        { id: "build-zmk.yml", type: "zmk" as const },
        { id: "build-qmk.yml", type: "qmk" as const },
      ];

      const keyboards: Record<string, import("../keyboards/keyboards.schema.ts").Keyboard> = {};

      for (const { id, type } of workflows) {
        try {
          const signal = AbortSignal.timeout(10_000);
          const { data: runs } = await ok.rest.actions.listWorkflowRuns({
            owner,
            repo,
            workflow_id: id,
            status: "completed",
            per_page: 10,
            request: { signal },
          });

          const successful = runs.workflow_runs.find(
            (r) => r.conclusion === "success",
          );
          if (!successful) continue;

          const { data: artifacts } =
            await ok.rest.actions.listWorkflowRunArtifacts({
              owner,
              repo,
              run_id: successful.id,
              request: { signal },
            });

          for (const artifact of artifacts.artifacts) {
            const name = artifact.name;
            if (name.startsWith("settings-reset")) continue;
            // Group left/right into a single keyboard entry by base name
            const base = name.replace(/-(?:left|right)$/, "");
            if (!keyboards[base]) {
              keyboards[base] = { workflow: id, artifact: base, type };
            }
          }
        } catch (e: any) {
          if (e?.name === "TimeoutError") throw e;
          // workflow doesn't exist in this repo, skip
        }
      }

      return keyboards;
    },

    async downloadArtifact(
      runId: string,
      artifactName: string,
      cacheDir: string,
      side?: string,
    ): Promise<void> {
      console.debug(`downloading from run ${runId}...`);

      const { data: artifacts } =
        await ok.rest.actions.listWorkflowRunArtifacts({
          owner,
          repo,
          run_id: Number(runId),
        });

      // Prefer side-specific artifact, fall back to base name, then merged "firmware" zip
      const sideSpecific = side ? `${artifactName}-${side}` : null;
      const artifact =
        (sideSpecific && artifacts.artifacts.find((a) => a.name === sideSpecific)) ||
        artifacts.artifacts.find((a) => a.name === artifactName) ||
        artifacts.artifacts.find((a) => a.name === "firmware");
      if (!artifact)
        throw new Error(
          `artifact "${sideSpecific ?? artifactName}" not found in run ${runId}`,
        );

      const { data } = await ok.rest.actions.downloadArtifact({
        owner,
        repo,
        artifact_id: artifact.id,
        archive_format: "zip",
      });

      rmSync(cacheDir, { recursive: true, force: true });
      mkdirSync(cacheDir, { recursive: true });

      const zipPath = join(cacheDir, "__artifact.zip");
      await Bun.write(zipPath, Buffer.from(data as ArrayBuffer));

      const unzip = Bun.spawnSync(["unzip", "-o", zipPath, "-d", cacheDir]);
      if (unzip.exitCode !== 0) throw new Error("unzip failed");
      rmSync(zipPath);
    },
  };
}
