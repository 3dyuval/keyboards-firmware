#!/usr/bin/env bash
# Usage: run via docker compose from scripts/docker/
#   docker compose -f scripts/docker/docker-compose.yml up qmk
# Builds QMK userspace targets, outputs .bin/.uf2 files to .cache/local/

set -euo pipefail

if [ ! -f /.dockerenv ]; then
  echo "Run via: ./scripts/docker/build.sh qmk" >&2
  exit 1
fi

USERSPACE_DIR=/qmk-userspace
BUILD_OUT=/build

mkdir -p "$BUILD_OUT"

export QMK_FIRMWARE=/qmk_firmware
export QMK_USERSPACE="$USERSPACE_DIR"

if [ ! -f "$QMK_FIRMWARE/.initialized" ]; then
  qmk setup --yes
  touch "$QMK_FIRMWARE/.initialized"
fi

echo ">>> Compiling QMK userspace targets"
qmk userspace-compile --print-failures || true

# Collect all new artifacts and copy to build output
find "$QMK_FIRMWARE" \( -name "*.bin" -o -name "*.uf2" -o -name "*.hex" \) | while read -r f; do
  dest="$BUILD_OUT/$(basename "$f")"
  # Handle duplicate basenames by appending a suffix
  if [ -f "$dest" ]; then
    ext="${f##*.}"
    base="${f%.*}"
    counter=1
    while [ -f "$BUILD_OUT/$(basename "$base")_${counter}.${ext}" ]; do
      ((counter++))
    done
    dest="$BUILD_OUT/$(basename "$base")_${counter}.${ext}"
  fi
  cp "$f" "$dest"
  echo "    -> $dest"
done

echo "QMK build complete."
