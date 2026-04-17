#!/usr/bin/env bash
# Replicates zmkfirmware/zmk/.github/workflows/build-user-config.yml
# Expects: zmk-west volume at /west, repo at /zmk-config, output at /build
set -euo pipefail

CONFIG_SRC=/zmk-config
WEST_DIR=/west
CONFIG_DIR=$WEST_DIR/config
BUILD_OUT=/build

mkdir -p "$CONFIG_DIR" "$BUILD_OUT"

if [ ! -f "$WEST_DIR/.initialized" ]; then
  cp -R "$CONFIG_SRC/config/"* "$CONFIG_DIR/"
  cd "$WEST_DIR"
  west init -l "$CONFIG_DIR"
  west update --fetch-opt=--filter=tree:0
  west zephyr-export
  touch "$WEST_DIR/.initialized"
else
  cp -R "$CONFIG_SRC/config/"* "$CONFIG_DIR/"
fi

python3 - <<'EOF'
import yaml, subprocess, shutil, sys, os

with open('/zmk-config/build.yaml') as f:
    data = yaml.safe_load(f)

WEST_DIR = '/west'
BUILD_OUT = '/build'
CONFIG_DIR = f'{WEST_DIR}/config'
ZMK_EXTRA_MODULES = '/zmk-config'

failed = []

for entry in data['include']:
    board    = entry['board']
    shield   = entry.get('shield', '')
    snippet  = entry.get('snippet', '')
    artifact = entry['artifact-name']
    cmake_args = entry.get('cmake-args', '')

    build_dir = f'{BUILD_OUT}/{artifact}'
    os.makedirs(build_dir, exist_ok=True)

    cmd = ['west', 'build', '-s', 'zmk/app', '-d', build_dir, '-b', board]
    if snippet:
        cmd += ['-S', snippet]
    cmd += ['--', f'-DZMK_CONFIG={CONFIG_DIR}', f'-DZMK_EXTRA_MODULES={ZMK_EXTRA_MODULES}']
    if shield:
        cmd += [f'-DSHIELD={shield}']
    if cmake_args:
        cmd += cmake_args.split()

    print(f'\n── Building {artifact} ──', flush=True)
    result = subprocess.run(cmd, cwd=WEST_DIR)

    if result.returncode == 0:
        uf2 = f'{build_dir}/zephyr/zmk.uf2'
        if os.path.exists(uf2):
            shutil.copy(uf2, f'{BUILD_OUT}/{artifact}.uf2')
        print(f'✓ {artifact}', flush=True)
    else:
        print(f'✗ {artifact}', file=sys.stderr, flush=True)
        failed.append(artifact)

if failed:
    print(f'\nFailed: {", ".join(failed)}', file=sys.stderr)
    sys.exit(1)
EOF
