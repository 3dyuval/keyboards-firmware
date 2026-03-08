import { existsSync } from "fs";
import { join } from "path";
import ora from "ora";

const reset = "\x1b[0m";
const c = (color: string, text: string) => `${Bun.color(color, "ansi")}${text}${reset}`;

async function waitForEnter() {
  process.stdout.write("> ");
  for await (const _ of console) { return; }
}

export function findMount(): string | null {
  const result = Bun.spawnSync(["sh", "-c", `ls /dev/disk/by-label/NICENANO /dev/disk/by-label/XIAO-SENSE 2>/dev/null | head -1`]);
  const dev = result.stdout.toString().trim();
  if (!dev) return null;

  const realDev = Bun.spawnSync(["readlink", "-f", dev]).stdout.toString().trim();
  const mounted = Bun.spawnSync(["lsblk", "-no", "MOUNTPOINT", realDev]).stdout.toString().trim();
  if (mounted) return mounted;

  const udisk = Bun.spawnSync(["udisksctl", "mount", "-b", realDev]);
  const match = udisk.stdout.toString().match(/at (.+)/);
  if (match) return match[1].trim();
  return null;
}

export async function waitForDrive(label?: string, spinner: any = "arrow3"): Promise<string> {
  const mount = findMount();
  if (mount) return mount;
  const msg = label
    ? `put ${c("magenta", label)} in bootloader mode`
    : "put board in bootloader mode";
  const spin = ora({ discardStdin: false, text: msg, spinner, color: "magenta" }).start();
  while (true) {
    await Bun.sleep(500);
    const mount = findMount();
    if (mount) { spin.succeed(c("green", mount)); return mount; }
  }
}

async function cp(src: string, dest: string) {
  await Bun.spawn(["cp", src, dest]).exited;
}

async function sync() {
  await Bun.spawn(["sync"]).exited;
}

function resetName(keyboard: string): string {
  if (keyboard === "totem") return "settings-reset-xiao";
  if (keyboard === "eyelash") return "settings-reset-eyelash";
  return "settings-reset-nano";
}

export async function flashZmk(keyboard: string, side: string, reset: boolean, cacheDir: string, skip = false) {
  const firmware = `${keyboard}-${side}.uf2`;
  const path = join(cacheDir, firmware);
  if (!existsSync(path)) {
    const files = Bun.spawnSync(["ls", cacheDir]).stdout.toString();
    throw new Error(`not found: ${firmware}\navailable: ${files}`);
  }

  const sideColor = side === "left" ? "blue" : "yellow";
  const sideSpinner = side === "left"
    ? { interval: 120, frames: ["◃◃◃◃◂", "◃◃◃◂◃", "◃◃◂◃◃", "◃◂◃◃◃", "◂◃◃◃◃", "◃◃◃◃◃"] }
    : "arrow3";
  let mount = await waitForDrive(`${keyboard} ${c(sideColor, side)}`, sideSpinner);
  if (!skip) {
    const confirmSpin = ora({ discardStdin: false, text: `flash ${c("cyan", firmware)} to ${mount}? press enter or ctrl-c`, spinner: "arrow3", color: "magenta" }).start();
    await waitForEnter();
    confirmSpin.stop();
  }

  if (reset) {
    const resetFile = join(cacheDir, `${resetName(keyboard)}.uf2`);
    if (existsSync(resetFile)) {
      const resetSpin = ora({ discardStdin: false, text: "flashing settings reset...", spinner: "arc" }).start();
      await cp(resetFile, `${mount}/`);
      await sync();
      resetSpin.succeed("settings reset");
      mount = await waitForDrive(`${keyboard} ${side}`);
    }
  }

  const flashSpin = ora({ discardStdin: false, text: `flashing ${c("cyan", firmware)}...`, spinner: "arc" }).start();
  await cp(path, `${mount}/`);
  await sync();
  flashSpin.succeed(c("green", `${firmware} flashed`));
  return { keyboard, side, firmware, reset };
}

export async function flashQmk(cacheDir: string) {
  const result = Bun.spawnSync(["find", cacheDir, "-name", "*.bin"]);
  const firmware = result.stdout.toString().trim().split("\n")[0];
  if (!firmware) throw new Error("no .bin firmware found");

  const lsusb = Bun.spawnSync(["lsusb"]).stdout.toString();
  if (!lsusb.includes("0483:df11")) {
    const spin = ora({ discardStdin: false, text: `put ${c("magenta", "iris")} in DFU mode (double-tap reset)`, spinner: "arrow3", color: "magenta" }).start();
    while (true) {
      await Bun.sleep(500);
      const check = Bun.spawnSync(["lsusb"]).stdout.toString();
      if (check.includes("0483:df11")) { spin.succeed("DFU device found"); break; }
    }
  }

  const flashSpin = ora({ discardStdin: false, text: `flashing ${c("cyan", firmware)}...`, spinner: "arc" }).start();
  Bun.spawnSync(["dfu-util", "-a", "0", "-d", "0483:df11", "-s", "0x08000000:leave", "-D", firmware], {
    stdin: "inherit", stdout: "inherit", stderr: "inherit",
  });
  flashSpin.succeed(c("green", "iris flashed"));
  return { keyboard: "iris", firmware };
}
