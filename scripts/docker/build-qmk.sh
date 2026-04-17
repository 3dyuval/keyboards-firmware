#!/usr/bin/env bash
# Replicates qmk/.github/.github/workflows/qmk_userspace_build.yml
# Expects: qmk-firmware volume at /workspace/qmk_firmware, repo at /workspace/userspace
set -euo pipefail

USERSPACE=/workspace/userspace
QMK_HOME=/workspace/qmk_firmware
BUILD_OUT=/build

mkdir -p "$BUILD_OUT"

if [ ! -f "$QMK_HOME/.initialized" ]; then
  git clone --depth 1 --recurse-submodules --shallow-submodules \
    https://github.com/qmk/qmk_firmware "$QMK_HOME"
  touch "$QMK_HOME/.initialized"
fi

pip install -q -r "$QMK_HOME/requirements.txt"

qmk config user.qmk_home="$QMK_HOME"
qmk config user.overlay_dir="$USERSPACE"
qmk config userspace_compile.parallel="$(nproc)"

qmk userspace-doctor
qmk userspace-compile -e DUMP_CI_METADATA=yes

find "$USERSPACE" -maxdepth 1 \( -name '*.hex' -o -name '*.uf2' -o -name '*.bin' \) \
  -exec cp {} "$BUILD_OUT/" \;
