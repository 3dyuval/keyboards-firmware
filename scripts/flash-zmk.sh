#!/bin/bash
set -e

# Parse flags
USE_CACHE=false
RESET=false
while getopts "cr" opt; do
  case $opt in
  c) USE_CACHE=true ;;
  r) RESET=true ;;
  esac
done
shift $((OPTIND - 1))

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
KEYBOARD=${1:-$("$SCRIPT_DIR/configs.sh" | gum choose --header "Keyboard")}
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

# Find bootloader drive and return its mount point (mounting if needed)
find_and_mount() {
  BASE=/dev/disk/by-label
  LABEL=""
  for l in NICENANO XIAO-SENSE; do
    if [[ -e "${BASE}/${l}" ]]; then
      LABEL="$l"
      break
    fi
  done
  if [ -z "$LABEL" ]; then
    LABEL=$(ls "$BASE" 2>/dev/null | gum choose)
  fi
  [ -z "$LABEL" ] && return 1

  DEV=$(readlink -f "${BASE}/${LABEL}")
  MOUNT=$(lsblk -no MOUNTPOINT "$DEV" 2>/dev/null | head -1)

  if [ -z "$MOUNT" ]; then
    MOUNT=$(udisksctl mount -b "$DEV" 2>/dev/null | grep -oP 'at \K.+')
  fi

  echo "$MOUNT"
}

MOUNT=$(find_and_mount) || true

if [ -z "$MOUNT" ]; then
  gum confirm "Put $KEYBOARD $SIDE in bootloader mode, then confirm" || exit 1
  MOUNT=$(find_and_mount) || true
fi

if [ -z "$MOUNT" ] || [ ! -d "$MOUNT" ]; then
  gum style --foreground 196 "No bootloader drive found"
  exit 1
fi

flash_file() {
  local file="$1" name="$2"
  gum style --foreground 212 "Flashing $name..."
  cp "$file" "$MOUNT/"
  sync
}

if [ "$RESET" = true ] && [ -f "$FIRMWARE_DIR/settings-reset-xiao.uf2" ]; then
  flash_file "$FIRMWARE_DIR/settings-reset-xiao.uf2" "settings reset"
  gum style --foreground 76 "Settings cleared!"
  gum confirm "Put $KEYBOARD $SIDE in bootloader mode again, then confirm" || exit 1
  MOUNT=$(find_and_mount) || true
  if [ -z "$MOUNT" ] || [ ! -d "$MOUNT" ]; then
    gum style --foreground 196 "No bootloader drive found"
    exit 1
  fi
fi

flash_file "$FIRMWARE_DIR/$FIRMWARE" "$FIRMWARE"
gum style --foreground 76 "Done!"
