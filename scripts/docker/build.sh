#!/usr/bin/env bash
# Usage: ./scripts/docker/build.sh [zmk|qmk]
#   zmk  — build all ZMK targets, output to .cache/local/
#   qmk  — build QMK userspace, output to .cache/local/
#   (none) — build both
# Logs written to .cache/logs/{service}-latest.log

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
COMPOSE_FILE="$(dirname "$0")/docker-compose.yml"
LOG_DIR="$REPO_ROOT/.cache/logs"
mkdir -p "$LOG_DIR"

trap 'docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null' EXIT

run() {
  local service="$1"
  local log="$LOG_DIR/${service}-latest.log"
  echo ">>> building $service (log: .cache/logs/${service}-latest.log)"
  docker compose -f "$COMPOSE_FILE" up --abort-on-container-exit "$service" 2>&1 | tee "$log"
  local exit_code="${PIPESTATUS[0]}"
  if [ "$exit_code" -ne 0 ]; then
    echo "!!! $service failed — see $log" >&2
    exit "$exit_code"
  fi
}

SERVICE="${1:-}"
if [ -n "$SERVICE" ]; then
  run "$SERVICE"
else
  run zmk
  run qmk
fi
