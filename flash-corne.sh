#!/bin/bash
set -e

# Parse flags
USE_CACHE=false
while getopts "c" opt; do
  case $opt in
    c) USE_CACHE=true ;;
  esac
done
shift $((OPTIND-1))

KEYBOARD=${1:-$(gum choose 'eyelash' 'corne')}
SIDE=${2:-$(gum choose 'left' 'right')}

REPO="3dyuval/keyboards-firmware"
FIRMWARE="${KEYBOARD}-${SIDE}.uf2"
FIRMWARE_DIR=".cache/artifacts"

# Fetch latest build (unless cached)
if [ "$USE_CACHE" = true ] && [ -f "$FIRMWARE_DIR/$FIRMWARE" ]; then
  gum style --foreground 212 "Using cached firmware"
else
  gum spin --title "Fetching latest build..." -- bash -c '
    RUN_ID=$(gh run list --repo "'"$REPO"'" --workflow=build-zmk.yml --limit 1 --status completed --json databaseId --jq ".[0].databaseId")
    if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
      exit 1
    fi
    rm -rf "'"$FIRMWARE_DIR"'"
    gh run download "$RUN_ID" --repo "'"$REPO"'" --name firmware --dir "'"$FIRMWARE_DIR"'"
  '
fi

if [ ! -f "$FIRMWARE_DIR/$FIRMWARE" ]; then
  gum style --foreground 196 "Firmware not found: $FIRMWARE"
  echo "Available: $(ls "$FIRMWARE_DIR")"
  exit 1
fi

# Find bootloader drive
find_drive() {
  BASE=/dev/disk/by-label
  DEFAULT="${BASE}/NICENANO"
  if [[ -e "$DEFAULT" ]]; then
    echo "$DEFAULT"
  else
    ls "$BASE" 2>/dev/null | gum choose
  fi
}

DRIVE=$(find_drive)

if [ -z "$DRIVE" ]; then
  gum confirm "Put $KEYBOARD $SIDE in bootloader mode, then confirm" || exit 1
  DRIVE=$(find_drive)
fi

if [ -z "$DRIVE" ] || [ ! -e "$DRIVE" ]; then
  gum style --foreground 196 "No bootloader drive found"
  exit 1
fi

gum style --foreground 212 "Flashing $FIRMWARE..."
cp "$FIRMWARE_DIR/$FIRMWARE" "$DRIVE/"
sync
gum style --foreground 76 "Done!"
