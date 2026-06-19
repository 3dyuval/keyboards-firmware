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

echo ">>> Compiling QMK userspace targets"
qmk userspace-compile --print-failures

find "$BUILD_OUT" \( -name "*.bin" -o -name "*.uf2" \) | while read -r f; do
  echo "    -> $f"
done

echo "QMK build complete."
