#!/bin/bash
# Draw keymap visualizations. Optionally filter by keyboard name (arg or stdin).
set -e

REPO_DIR="$(cd "$(git rev-parse --git-dir)" && cd .. && pwd)"
VENV_DIR="$REPO_DIR/.venv"
OUTPUT_DIR="$REPO_DIR/keymap-drawer"
CONFIG="$REPO_DIR/keymap_drawer.config.yaml"

# Accept filter from arg, stdin (pipe), or draw all
FILTER="${1:-}"
if [ -z "$FILTER" ] && [ ! -t 0 ]; then
  read -r FILTER
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating venv..."
  python -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

if ! command -v keymap &>/dev/null; then
  echo "Installing keymap-drawer..."
  pip install keymap-drawer
fi

mkdir -p "$OUTPUT_DIR"

draw_zmk() {
  local kmap="$1"
  local name
  name=$(basename "$kmap" .keymap)
  echo "  $name"
  keymap -c "$CONFIG" parse -z "$kmap" >"$OUTPUT_DIR/$name.yaml"
  keymap -c "$CONFIG" draw "$OUTPUT_DIR/$name.yaml" >"$OUTPUT_DIR/$name.svg"
}

# Draw ZMK keymaps
echo "Drawing ZMK keymaps..."
if [ -n "$FILTER" ]; then
  kmap="$REPO_DIR/config/$FILTER.keymap"
  if [ -f "$kmap" ]; then
    draw_zmk "$kmap"
  else
    echo "No keymap found: $kmap" >&2
    exit 1
  fi
else
  for kmap in "$REPO_DIR"/config/*.keymap; do
    draw_zmk "$kmap"
  done
fi

# Draw QMK keymaps (Iris) — only when drawing all
if [ -z "$FILTER" ] || [ "$FILTER" = "iris" ]; then
  if [ -f "$REPO_DIR/keyboards/keebio/iris_lm/k1/keymaps/graphite/keymap.json" ]; then
    echo "Drawing QMK keymaps..."
    echo "  iris"
    keymap -c "$CONFIG" parse -q "$REPO_DIR/keyboards/keebio/iris_lm/k1/keymaps/graphite/keymap.json" >"$OUTPUT_DIR/iris.yaml"
    keymap -c "$CONFIG" draw "$OUTPUT_DIR/iris.yaml" >"$OUTPUT_DIR/iris.svg"
  fi
fi

echo "Done! Output in $OUTPUT_DIR"
