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

REPO="3dyuval/keyboards-firmware"
FIRMWARE_DIR=".cache/artifacts"

# Fetch latest build (unless cached)
if [ "$USE_CACHE" = true ] && [ -n "$(find "$FIRMWARE_DIR" -name "*.bin" 2>/dev/null)" ]; then
  gum style --foreground 212 "Using cached firmware"
else
  gum spin --title "Fetching latest QMK build..." -- bash -c '
    RUN_ID=$(gh run list --repo "'"$REPO"'" --workflow=build-qmk.yml --limit 1 --status completed --json databaseId --jq ".[0].databaseId")
    if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
      exit 1
    fi
    rm -rf "'"$FIRMWARE_DIR"'"
    gh run download "$RUN_ID" --repo "'"$REPO"'" --name Firmware --dir "'"$FIRMWARE_DIR"'"
  '
fi

FIRMWARE=$(find "$FIRMWARE_DIR" -name "*.bin" 2>/dev/null | head -1)

if [ -z "$FIRMWARE" ]; then
  gum style --foreground 196 "Firmware not found"
  echo "Available: $(ls "$FIRMWARE_DIR" 2>/dev/null)"
  exit 1
fi

gum style --foreground 212 "Found: $(basename "$FIRMWARE")"

# Wait for DFU device with retry
while true; do
  if lsusb | grep -q "0483:df11"; then
    gum style --foreground 212 "DFU device detected, flashing..."
    dfu-util -a 0 -d 0483:df11 -s 0x08000000:leave -D "$FIRMWARE" || true
    break
  fi
  gum confirm "Put Iris in DFU mode (double-tap reset), then confirm" || exit 1
done

gum style --foreground 76 "Done!"
