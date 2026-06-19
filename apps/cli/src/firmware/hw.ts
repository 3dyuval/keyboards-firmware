import { existsSync } from "fs";
import { join, basename } from "path";
import type { ServiceEvent } from "../../lib/types.ts";

export function findMount(labels?: string[]): string | null {
  const defaultLabels = ["NICENANO", "XIAO-SENSE", "RPI-RP2", "FEATHERBOOT"];
  const searchLabels = labels && labels.length ? [...new Set([...labels, ...defaultLabels])] : defaultLabels;
  const labelPattern = searchLabels.join(" /dev/disk/by-label/");
  
  const result = Bun.spawnSync([
    "sh",
    "-c",
    `ls /dev/disk/by-label/${labelPattern} 2>/dev/null | head -1`,
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

async function waitForMount(labels?: string[]): Promise<string> {
  const mount = findMount(labels);
  if (mount) return mount;
  while (true) {
    await Bun.sleep(500);
    const m = findMount(labels);
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
  artifactPath: string,
  reset: boolean,
  buildDir: string,
  skip = false,
): AsyncGenerator<ServiceEvent> {
  const firmware = `${keyboard}-${side}.uf2`;
  const path = artifactPath;
  if (!existsSync(path)) {
    throw new Error(`not found: ${path}`);
  }

  yield ["waiting", `put ${keyboard} ${side} in bootloader mode`, undefined];
  const mount = await waitForMount();
  yield ["device-found", mount, undefined];

  if (!skip) {
    yield ["confirm", `flash ${firmware} to ${mount}?`, undefined];
  }

  if (reset) {
    const resetFile = join(buildDir, "local", `${resetName(keyboard)}.uf2`);
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

export async function* flashDfu(
  firmware: string,
  device: string,
  address: string,
  keyboard: string = "keyboard",
): AsyncGenerator<ServiceEvent> {
  if (!existsSync(firmware)) throw new Error(`not found: ${firmware}`);

  const dfuUtil = Bun.which("dfu-util");
  if (!dfuUtil) {
    throw new Error("dfu-util not installed. Install: sudo pacman -S dfu-util");
  }

  const [vid, pid] = device.split(":");
  yield ["waiting", `put ${keyboard} in DFU mode (double-tap reset)`, undefined] as ServiceEvent;
  while (!Bun.spawnSync(["lsusb"]).stdout.toString().includes(device)) {
    await Bun.sleep(500);
  }
  yield ["device-found", `${keyboard} in DFU mode`, undefined] as ServiceEvent;

  yield ["flashing", `flashing ${firmware}...`, undefined] as ServiceEvent;
  const proc = Bun.spawn(
    ["dfu-util", "-a", "0", "-d", device, "-s", `${address}:leave`, "-D", firmware],
    { stdin: "pipe", stdout: "pipe", stderr: "pipe" },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0 && exitCode !== 74) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`dfu-util failed (exit ${exitCode}): ${stderr}`);
  }
  yield ["flashed", `${keyboard} flashed`, { keyboard, firmware }] as ServiceEvent;
}

export async function* flashMassStorage(
  firmware: string,
  labels: string | string[],
  keyboard: string = "keyboard",
  resetFile?: string,
  autoReset = true,
): AsyncGenerator<ServiceEvent> {
  if (!existsSync(firmware)) throw new Error(`not found: ${firmware}`);

  const labelList = Array.isArray(labels) ? labels : [labels];
  yield ["waiting", `put ${keyboard} in bootloader mode`, undefined] as ServiceEvent;
  const mount = await waitForMount(labelList);
  yield ["device-found", mount, undefined];

  if (resetFile && existsSync(resetFile)) {
    yield ["resetting", "flashing settings reset...", undefined];
    await Bun.spawn(["cp", resetFile, `${mount}/`]).exited;
    await Bun.spawn(["sync"]).exited;
    yield ["reset-done", "settings reset", undefined];

    yield ["waiting", `put ${keyboard} back in bootloader mode`, undefined];
    const mount2 = await waitForMount(labelList);
    yield ["device-found", mount2, undefined];
  }

  yield ["flashing", `copying firmware to ${mount}...`, undefined] as ServiceEvent;
  // For RP2040: copy to temp .bin, rename to .uf2 triggers auto-reset
  // For nRF52840 Feather (autoReset=false): just copy, no rename trick needed
  if (autoReset) {
    const tmpFile = join(mount, `__tmp_flash_${Date.now()}.bin`);
    await Bun.spawn(["cp", firmware, tmpFile]).exited;
    await Bun.spawn(["sync"]).exited;
    const firmwareName = basename(firmware);
    await Bun.spawn(["mv", tmpFile, `${mount}/${firmwareName}`]).exited;
    // Board resets after receiving .uf2 — don't sync after rename (device gone)
  } else {
    // nRF52840 Feather: copy directly, board does NOT auto-reset on .uf2
    await Bun.spawn(["cp", firmware, `${mount}/`]).exited;
    await Bun.spawn(["sync"]).exited;
  }
  yield ["flashed", `${keyboard} flashed`, { keyboard, firmware }] as ServiceEvent;
}
