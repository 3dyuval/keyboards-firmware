#!/bin/bash
# Draw keymap visualizations for all keyboards
set -e

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$REPO_DIR/.venv"
OUTPUT_DIR="$REPO_DIR/keymap-drawer"
CONFIG="$REPO_DIR/keymap_drawer.config.yaml"

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating venv..."
  python -m venv "$VENV_DIR"
fi

source "$VENV_DIR/bin/activate"

if ! command -v keymap &> /dev/null; then
  echo "Installing keymap-drawer..."
  pip install keymap-drawer
fi

mkdir -p "$OUTPUT_DIR"

# Draw ZMK keymaps (Corne, Eyelash Corne, TOTEM)
echo "Drawing ZMK keymaps..."
for kmap in "$REPO_DIR"/config/*.keymap; do
  name=$(basename "$kmap" .keymap)
  echo "  $name"
  keymap -c "$CONFIG" parse -z "$kmap" > "$OUTPUT_DIR/$name.yaml"
  keymap -c "$CONFIG" draw "$OUTPUT_DIR/$name.yaml" > "$OUTPUT_DIR/$name.svg"
done

# Draw QMK keymaps (Iris)
echo "Drawing QMK keymaps..."
if [ -f "$REPO_DIR/keyboards/keebio/iris_lm/k1/keymaps/graphite/keymap.json" ]; then
  echo "  iris"
  keymap -c "$CONFIG" parse -q "$REPO_DIR/keyboards/keebio/iris_lm/k1/keymaps/graphite/keymap.json" > "$OUTPUT_DIR/iris.yaml"
  keymap -c "$CONFIG" draw "$OUTPUT_DIR/iris.yaml" > "$OUTPUT_DIR/iris.svg"
fi

echo "Done! Output in $OUTPUT_DIR"
