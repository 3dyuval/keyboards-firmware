#!/bin/bash
set -e

KEYBOARD=${1:-$(gum choose 'eyelash' 'corne')}
SIDE=${2:-$(gum choose 'left' 'right')}

REPO="3dyuval/keyboards-firmware"
FIRMWARE="${KEYBOARD}-${SIDE}.uf2"
FIRMWARE_DIR=".cache/artifacts"

# Fetch latest build
echo "Fetching latest build..."
RUN_ID=$(gh run list --repo "$REPO" --workflow=build-zmk.yml --limit 1 --status completed --json databaseId --jq '.[0].databaseId')

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "No completed builds found"
  exit 1
fi

# Download firmware
rm -rf "$FIRMWARE_DIR"
gh run download "$RUN_ID" --repo "$REPO" --name firmware --dir "$FIRMWARE_DIR"

if [ ! -f "$FIRMWARE_DIR/$FIRMWARE" ]; then
  echo "Firmware not found: $FIRMWARE"
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
  |  ls "$BASE" | gum choose
  fi
}

DRIVE=$(find_drive)

if [ -z "$DRIVE" ]; then
  echo "Put $KEYBOARD $SIDE in bootloader mode, then press Enter..."
  read -r
  DRIVE=$(find_drive)
fi

if [ -z "$DRIVE" ] || [ ! -w "$DRIVE" ]; then
  echo "No writable bootloader drive found"
  exit 1
fi

echo "Flashing $FIRMWARE to $DRIVE..."
cp "$FIRMWARE_DIR/$FIRMWARE" "$DRIVE/"
sync
echo "Done!"
