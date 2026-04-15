import { join } from "path";
import { mkdirSync, copyFileSync, existsSync } from "fs";
import type { App } from "../../app.ts";
import type { ServiceEvent } from "../../../lib/types.ts";
import type { LocalBuildConfig } from "../../keyboards/keyboards.schema.ts";

export async function* acquire(
  app: App,
  {
    keyboard,
    local,
    type,
    cacheDir,
    side,
  }: {
    keyboard: string;
    local: LocalBuildConfig;
    type: "qmk" | "zmk";
    cacheDir: string;
    side?: string;
  },
): AsyncGenerator<ServiceEvent> {
  const root = app.get("root") as string;
  mkdirSync(cacheDir, { recursive: true });

  if (type === "qmk") {
    yield* buildQmk(root, keyboard, local, cacheDir);
  } else {
    yield* buildZmk(root, keyboard, local, cacheDir, side);
  }
}

async function* buildQmk(
  root: string,
  keyboard: string,
  local: LocalBuildConfig,
  cacheDir: string,
): AsyncGenerator<ServiceEvent> {
  if (!local.kb || !local.km) {
    throw new Error(`local.kb and local.km required for QMK build of "${keyboard}"`);
  }

  yield ["building", `qmk compile -kb ${local.kb} -km ${local.km}`, undefined];

  const proc = Bun.spawn(["qmk", "compile", "-kb", local.kb, "-km", local.km], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`qmk compile failed (exit ${code})`);

  const binName = `${local.kb.replace(/\//g, "_")}_${local.km}.bin`;
  const binPath = join(root, binName);
  if (!existsSync(binPath)) {
    throw new Error(`build succeeded but ${binName} not found in ${root}`);
  }

  copyFileSync(binPath, join(cacheDir, binName));
  yield ["built", `${binName} ready`, { cacheDir }];
}

async function* buildZmk(
  root: string,
  keyboard: string,
  local: LocalBuildConfig,
  cacheDir: string,
  side?: string,
): AsyncGenerator<ServiceEvent> {
  if (!local.board) {
    throw new Error(`local.board required for ZMK build of "${keyboard}"`);
  }

  const shield = local.shield ?? keyboard;
  const shieldArg = side ? `${shield}_${side}` : shield;
  const buildDir = join(root, ".build", keyboard, side ?? "main");

  yield ["building", `west build -b ${local.board} -S ${shieldArg}`, undefined];

  const proc = Bun.spawn(
    ["west", "build", "-b", local.board, "-S", shieldArg, "--build-dir", buildDir],
    {
      cwd: root,
      stdout: "inherit",
      stderr: "inherit",
    },
  );
  const code = await proc.exited;
  if (code !== 0) throw new Error(`west build failed (exit ${code})`);

  const uf2Src = join(buildDir, "zephyr", "zmk.uf2");
  if (!existsSync(uf2Src)) {
    throw new Error(`build succeeded but zmk.uf2 not found at ${uf2Src}`);
  }

  const destName = `${keyboard}-${side ?? "main"}.uf2`;
  copyFileSync(uf2Src, join(cacheDir, destName));
  yield ["built", `${destName} ready`, { cacheDir }];
}
