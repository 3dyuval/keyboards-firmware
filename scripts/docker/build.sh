#!/usr/bin/env bash
# Usage: ./scripts/docker/build.sh [zmk|qmk]
#   zmk  — build all ZMK targets, output to .cache/local/
#   qmk  — build QMK userspace, output to .cache/local/
#   (none) — build both

set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"
SERVICE="${1:-}"

if [ -n "$SERVICE" ]; then
  docker compose -f "$COMPOSE_FILE" up --abort-on-container-exit "$SERVICE"
else
  docker compose -f "$COMPOSE_FILE" up --abort-on-container-exit
fi
