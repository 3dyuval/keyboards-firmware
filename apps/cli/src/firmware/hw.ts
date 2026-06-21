import { existsSync } from "fs";
import { join, basename } from "path";
import type { ServiceEvent } from "../../lib/types.ts";

export function findMount(labels?: string[]): string | null {
  const defaultLabels = ["NICENANO", "XIAO-SENSE", "RPI-RP2", "FEATHERBOOT"];
  const searchLabels = labels && labels.length ? labels : defaultLabels;

  // Resolve the device by LABEL via lsblk rather than /dev/disk/by-label/.
  // The by-label symlinks aren't always created by udev (observed on this
  // setup), but lsblk reads the filesystem label directly and is reliable.
  const lsblk = Bun.spawnSync(["lsblk", "-rno", "NAME,LABEL,MOUNTPOINT"]);
  const lines = lsblk.stdout.toString().trim().split("\n");
  let realDev: string | null = null;
  for (const line of lines) {
    // columns: NAME LABEL MOUNTPOINT (MOUNTPOINT may be empty)
    const [name, label, mountpoint] = line.trim().split(/\s+/);
    if (label && searchLabels.includes(label)) {
      if (mountpoint) return mountpoint; // already mounted
      realDev = `/dev/${name}`;
      break;
    }
  }
  if (!realDev) return null;

  const udisk = Bun.spawnSync(["udisksctl", "mount", "-b", realDev]);
  const out = udisk.stdout.toString() + udisk.stderr.toString();
  // "Mounted /dev/sda at /run/media/..." or "already mounted at /run/media/..."
  const match = out.match(/at (\/\S+)/);
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
  if (autoReset) {
    // RP2040: the bootloader only flashes when a .uf2 *appears* via rename, so
    // copy to a temp .bin first, then rename to trigger the flash + auto-reset.
    const tmpFile = join(mount, `__tmp_flash_${Date.now()}.bin`);
    await Bun.spawn(["cp", firmware, tmpFile]).exited;
    await Bun.spawn(["sync"]).exited;
    const firmwareName = basename(firmware);
    await Bun.spawn(["mv", tmpFile, `${mount}/${firmwareName}`]).exited;
    // Board resets after receiving .uf2 — don't sync after rename (device gone)
  } else {
    // nRF52840 UF2 bootloader (nice!nano): flashes the instant a complete file
    // lands, then immediately unmounts. The cp/sync therefore race the
    // disconnect and may exit nonzero even on success — that disconnect IS the
    // success signal, so don't treat it as an error.
    await Bun.spawn(["cp", firmware, `${mount}/`]).exited;
    await Bun.spawn(["sync"]).exited.catch(() => {});
  }
  yield ["flashed", `${keyboard} flashed`, { keyboard, firmware }] as ServiceEvent;
}
