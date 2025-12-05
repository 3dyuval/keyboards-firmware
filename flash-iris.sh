#!/bin/bash
set -e

REPO="3dyuval/keyboards-firmware"
FIRMWARE_DIR=".cache/artifacts"

# Fetch latest build
echo "Fetching latest QMK build for Iris..."
RUN_ID=$(gh run list --repo "$REPO" --workflow=build-qmk.yml --limit 1 --status completed --json databaseId --jq '.[0].databaseId')

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
  echo "No completed builds found"
  exit 1
fi

# Download firmware
rm -rf "$FIRMWARE_DIR"
gh run download "$RUN_ID" --repo "$REPO" --name Firmware --dir "$FIRMWARE_DIR"

# Find the firmware file (.bin)
FIRMWARE=$(find "$FIRMWARE_DIR" -name "*.bin" | head -1)

if [ -z "$FIRMWARE" ]; then
  echo "Firmware not found"
  echo "Available: $(ls "$FIRMWARE_DIR")"
  exit 1
fi

echo "Found: $(basename "$FIRMWARE")"
echo "Put Iris in DFU mode (hold BOOT + tap RESET), then press Enter..."
read -r

# Flash using dfu-util
echo "Flashing..."
dfu-util -a 0 -d 0483:df11 -s 0x08000000:leave -D "$FIRMWARE"

echo "Done!"
