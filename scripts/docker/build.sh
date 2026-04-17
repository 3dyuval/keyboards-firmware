#!/usr/bin/env bash
# Runs all firmware builds in parallel, mirrors CI workflow behavior.
#
# Usage:
#   ./scripts/docker/build.sh          — build both zmk and qmk in parallel
#   ./scripts/docker/build.sh zmk      — zmk only
#   ./scripts/docker/build.sh qmk      — qmk only
set -euo pipefail

COMPOSE="docker compose -f $(dirname "$0")/docker-compose.yml"
TARGET="${1:-}"

if [ -n "$TARGET" ]; then
  $COMPOSE up --abort-on-container-exit "$TARGET"
else
  $COMPOSE up --abort-on-container-exit
fi

$COMPOSE down
