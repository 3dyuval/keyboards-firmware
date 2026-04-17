#!/usr/bin/env bash
# Usage: run via docker compose from scripts/docker/
#   docker compose -f scripts/docker/docker-compose.yml up zmk
# Builds all ZMK targets from build.yaml, outputs .uf2 files to .cache/local/

set -euo pipefail

if [ ! -f /.dockerenv ]; then
  echo "Run via: ./scripts/docker/build.sh zmk" >&2
  exit 1
fi

REPO_DIR=/zmk-config
CONFIG_DIR=/west/config
WEST_DIR=/west
BUILD_OUT=/build

mkdir -p "$CONFIG_DIR" "$BUILD_OUT"

cp -R "$REPO_DIR/config/"* "$CONFIG_DIR/"

if [ ! -f "$WEST_DIR/.initialized" ]; then
  west init -l "$CONFIG_DIR"
  west update --fetch-opt=--filter=tree:0
  touch "$WEST_DIR/.initialized"
fi

# Re-run every time: writes to ~/.cmake inside container (not persisted in volume)
(cd "$WEST_DIR" && west zephyr-export)

REPO_DIR="$REPO_DIR" CONFIG_DIR="$CONFIG_DIR" BUILD_OUT="$BUILD_OUT" python3 - <<'EOF'
import yaml, subprocess, sys, os

build_yaml = os.path.join(os.environ["REPO_DIR"], "build.yaml")
with open(build_yaml) as f:
    data = yaml.safe_load(f)

failed = []
for entry in data.get("include", []):
    board   = entry["board"]
    shield  = entry.get("shield", "")
    snippet = entry.get("snippet", "")
    artifact = entry.get("artifact-name", shield.replace(" ", "_"))

    build_dir = f"/tmp/zmk-build/{artifact}"
    cmd = [
        "west", "build",
        "-s", "/west/zmk/app",
        "-b", board,
        "-d", build_dir,
        "--",
        f"-DZMK_CONFIG={os.environ['CONFIG_DIR']}",
        f"-DBOARD_ROOT={os.environ['REPO_DIR']}",
    ]
    if shield:
        cmd.extend([f"-DSHIELD={shield}"])
    if snippet:
        cmd.extend([f"-DSNIPPET={snippet}"])

    print(f">>> Building {artifact} ({board} {shield})", flush=True)
    result = subprocess.run(cmd, cwd="/west")
    if result.returncode != 0:
        print(f"!!! FAILED: {artifact}", flush=True)
        failed.append(artifact)
        continue

    uf2 = f"{build_dir}/zephyr/zmk.uf2"
    dest = f"{os.environ['BUILD_OUT']}/{artifact}.uf2"
    if os.path.exists(uf2):
        import shutil
        shutil.copy2(uf2, dest)
        print(f"    -> {dest}", flush=True)
    else:
        print(f"!!! No .uf2 found for {artifact}", flush=True)
        failed.append(artifact)

if failed:
    print(f"\nFailed: {failed}", file=sys.stderr)
    sys.exit(1)
print("\nAll builds complete.", flush=True)
EOF
