import type { Application } from "@feathersjs/feathers";
import { Octokit } from "octokit";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";

const APP_KEY = "_octokit";

function octo(app: Application): Octokit {
  const cached = app.get(APP_KEY) as Octokit | undefined;
  if (cached) return cached;

  const token =
    process.env.GITHUB_TOKEN ||
    process.env.GH_TOKEN ||
    process.env.GITHUB_AUTH_TOKEN ||
    (app.get("githubAuthToken") as string | undefined);
  if (!token) {
    throw new Error(
      "Missing GitHub token — set GITHUB_TOKEN env var or githubAuthToken in local.json",
    );
  }

  const instance = new Octokit({ auth: token });
  app.set(APP_KEY, instance);
  return instance;
}

export function github(app: Application) {
  const { owner, repo } = app.get("github") as {
    owner: string;
    repo: string;
  };
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
        result.inProgress = { id: run.id, created_at: run.created_at };
      }

      if (completedRuns.workflow_runs.length) {
        const run = completedRuns.workflow_runs[0];
        const { data: jobsData } =
          await ok.rest.actions.listJobsForWorkflowRun({
            owner,
            repo,
            run_id: run.id,
          });
        const jobs = jobsData.jobs
          .map((j) => `${j.conclusion}\t${j.name}`)
          .join("\n");
        result.completed = {
          id: run.id,
          conclusion: run.conclusion,
          jobs,
          created_at: run.created_at,
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

    async downloadArtifact(
      runId: string,
      artifactName: string,
      cacheDir: string,
    ): Promise<void> {
      console.debug(`downloading from run ${runId}...`);

      const { data: artifacts } =
        await ok.rest.actions.listWorkflowRunArtifacts({
          owner,
          repo,
          run_id: Number(runId),
        });

      const artifact = artifacts.artifacts.find(
        (a) => a.name === artifactName,
      );
      if (!artifact)
        throw new Error(
          `artifact "${artifactName}" not found in run ${runId}`,
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
