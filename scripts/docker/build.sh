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

run() {
  local service="$1"
  local log="$LOG_DIR/${service}-latest.log"
  echo ">>> building $service (log: .cache/logs/${service}-latest.log)"

  # Run detached, stream logs to file and stdout concurrently
  docker compose -f "$COMPOSE_FILE" up -d "$service"
  docker compose -f "$COMPOSE_FILE" logs -f "$service" | tee "$log" &
  local log_pid=$!

  # Wait for container to finish, then clean up log stream
  docker compose -f "$COMPOSE_FILE" wait "$service" 2>/dev/null || true
  kill $log_pid 2>/dev/null; wait $log_pid 2>/dev/null || true

  # Cleanup containers
  docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null
}

SERVICE="${1:-}"
if [ -n "$SERVICE" ]; then
  run "$SERVICE"
else
  run zmk
  run qmk
fi
