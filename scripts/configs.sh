#!/bin/bash
# List keyboard configs. Interactive: pick one and flash or draw.
set -e

REPO_DIR="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
CONFIG_DIR="$REPO_DIR/config"

# Collect keyboard names from .keymap files
configs=()
for kmap in "$CONFIG_DIR"/*.keymap; do
  configs+=("$(basename "$kmap" .keymap)")
done

# Non-interactive: just print configs (one per line, pipeable)
if [ ! -t 1 ]; then
  printf '%s\n' "${configs[@]}"
  exit 0
fi

# Interactive: let user pick a config and action
KEYBOARD=$(gum choose --header "Keyboard" "${configs[@]}")

ACTION=$(gum choose --header "Action for $KEYBOARD" \
  "draw" \
  "flash" \
  "print")

case "$ACTION" in
  draw)
    echo "$KEYBOARD" | "$REPO_DIR/scripts/draw-keymaps.sh"
    ;;
  flash)
    "$REPO_DIR/scripts/flash-zmk.sh" "$KEYBOARD"
    ;;
  print)
    echo "$KEYBOARD"
    ;;
esac
