import { existsSync } from "fs";
import { join } from "path";
import type { ServiceEvent } from "../../lib/types.ts";

export function findMount(): string | null {
  const result = Bun.spawnSync([
    "sh",
    "-c",
    `ls /dev/disk/by-label/NICENANO /dev/disk/by-label/XIAO-SENSE 2>/dev/null | head -1`,
  ]);
  const dev = result.stdout.toString().trim();
  if (!dev) return null;

  const realDev = Bun.spawnSync(["readlink", "-f", dev])
    .stdout.toString()
    .trim();
  const mounted = Bun.spawnSync(["lsblk", "-no", "MOUNTPOINT", realDev])
    .stdout.toString()
    .trim();
  if (mounted) return mounted;

  const udisk = Bun.spawnSync(["udisksctl", "mount", "-b", realDev]);
  const match = udisk.stdout.toString().match(/at (.+)/);
  if (match) return match[1].trim();
  return null;
}

async function waitForMount(): Promise<string> {
  const mount = findMount();
  if (mount) return mount;
  while (true) {
    await Bun.sleep(500);
    const m = findMount();
    if (m) return m;
  }
}

function resetName(keyboard: string): string {
  if (keyboard === "totem") return "settings-reset-xiao";
  if (keyboard === "eyelash") return "settings-reset-eyelash";
  return "settings-reset-nano";
}

export async function* flashZmk(
  keyboard: string,
  side: string,
  reset: boolean,
  cacheDir: string,
  skip = false,
): AsyncGenerator<ServiceEvent> {
  const firmware = `${keyboard}-${side}.uf2`;
  const path = join(cacheDir, firmware);
  if (!existsSync(path)) {
    const files = Bun.spawnSync(["ls", cacheDir]).stdout.toString();
    throw new Error(`not found: ${firmware}\navailable: ${files}`);
  }

  yield ["waiting", `put ${keyboard} ${side} in bootloader mode`, undefined];
  const mount = await waitForMount();
  yield ["device-found", mount, undefined];

  if (!skip) {
    yield ["confirm", `flash ${firmware} to ${mount}?`, undefined];
  }

  if (reset) {
    const resetFile = join(cacheDir, `${resetName(keyboard)}.uf2`);
    if (existsSync(resetFile)) {
      yield ["resetting", "flashing settings reset...", undefined];
      await Bun.spawn(["cp", resetFile, `${mount}/`]).exited;
      await Bun.spawn(["sync"]).exited;
      yield ["reset-done", "settings reset", undefined];

      yield ["waiting", `put ${keyboard} ${side} back in bootloader mode`, undefined];
      const mount2 = await waitForMount();
      yield ["device-found", mount2, undefined];
    }
  }

  yield ["flashing", `flashing ${firmware}...`, undefined];
  await Bun.spawn(["cp", path, `${mount}/`]).exited;
  await Bun.spawn(["sync"]).exited;
  yield ["flashed", `${firmware} flashed`, { keyboard, side, firmware, reset }];
}

export async function* flashQmk(
  cacheDir: string,
): AsyncGenerator<ServiceEvent> {
  const result = Bun.spawnSync(["find", cacheDir, "-name", "*.bin"]);
  const firmware = result.stdout.toString().trim().split("\n")[0];
  if (!firmware) throw new Error("no .bin firmware found");

  const dfuUtil = Bun.which("dfu-util");
  if (!dfuUtil) {
    throw new Error(
      "dfu-util not installed. Install: sudo pacman -S dfu-util",
    );
  }

  const lsusb = Bun.spawnSync(["lsusb"]).stdout.toString();
  if (!lsusb.includes("0483:df11")) {
    yield ["waiting", "put iris in DFU mode (double-tap reset)", undefined] as ServiceEvent;
    while (true) {
      await Bun.sleep(500);
      const check = Bun.spawnSync(["lsusb"]).stdout.toString();
      if (check.includes("0483:df11")) {
        yield ["device-found", "DFU device found", undefined] as ServiceEvent;
        break;
      }
    }
  }

  yield ["flashing", `flashing ${firmware}...`, undefined] as ServiceEvent;
  const proc = Bun.spawn(
    [
      dfuUtil,
      "-a", "0",
      "-d", "0483:df11",
      "-s", "0x08000000:leave",
      "-D", firmware,
    ],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0 && exitCode !== 74) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`dfu-util failed (exit ${exitCode}): ${stderr}`);
  }
  yield ["flashed", "iris flashed", { keyboard: "iris", firmware }] as ServiceEvent;
}
