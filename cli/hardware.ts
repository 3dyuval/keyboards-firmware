import { existsSync } from "fs";
import { join } from "path";

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

export function waitForDrive(): string {
  while (true) {
    const mount = findMount();
    if (mount) return mount;
    console.log("no bootloader drive -- put board in bootloader mode, press enter");
    Bun.spawnSync(["sh", "-c", "read _"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  }
}

function cp(src: string, dest: string) {
  Bun.spawnSync(["cp", src, dest]);
}

function sync() {
  Bun.spawnSync(["sync"]);
}

function resetName(keyboard: string): string {
  if (keyboard === "totem") return "settings-reset-xiao";
  if (keyboard === "eyelash") return "settings-reset-eyelash";
  return "settings-reset-nano";
}

export function flashZmk(keyboard: string, side: string, reset: boolean, cacheDir: string) {
  const firmware = `${keyboard}-${side}.uf2`;
  const path = join(cacheDir, firmware);
  if (!existsSync(path)) {
    const files = Bun.spawnSync(["ls", cacheDir]).stdout.toString();
    throw new Error(`not found: ${firmware}\navailable: ${files}`);
  }

  let mount = waitForDrive();

  if (reset) {
    const resetFile = join(cacheDir, `${resetName(keyboard)}.uf2`);
    if (existsSync(resetFile)) {
      console.log("flashing settings reset...");
      cp(resetFile, `${mount}/`);
      sync();
      console.log("done -- put board in bootloader mode again, press enter");
      Bun.spawnSync(["sh", "-c", "read _"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
      mount = waitForDrive();
    }
  }

  console.log(`flashing ${firmware}...`);
  cp(path, `${mount}/`);
  sync();
  console.log("done");
  return { keyboard, side, firmware, reset };
}

export function flashQmk(cacheDir: string) {
  const result = Bun.spawnSync(["find", cacheDir, "-name", "*.bin"]);
  const firmware = result.stdout.toString().trim().split("\n")[0];
  if (!firmware) throw new Error("no .bin firmware found");
  console.log(`found: ${firmware}`);

  while (true) {
    const lsusb = Bun.spawnSync(["lsusb"]).stdout.toString();
    if (lsusb.includes("0483:df11")) {
      console.log("flashing...");
      Bun.spawnSync(["dfu-util", "-a", "0", "-d", "0483:df11", "-s", "0x08000000:leave", "-D", firmware], {
        stdin: "inherit", stdout: "inherit", stderr: "inherit",
      });
      console.log("done");
      return { keyboard: "iris", firmware };
    }
    console.log("put iris in DFU mode (double-tap reset), press enter");
    Bun.spawnSync(["sh", "-c", "read _"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  }
}
