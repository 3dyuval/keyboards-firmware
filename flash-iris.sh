#!/bin/bash

set -e

if [ "$1" != "l" ] && [ "$1" != "r" ]; then
    echo "Usage: $0 <l|r>"
    echo "  l - flash left side"
    echo "  r - flash right side"
    exit 1
fi

SIDE="$1"
REPO="3dyuval/keyboards-firmware"

if [ "$SIDE" = "l" ]; then
    SIDE_NAME="left"
else
    SIDE_NAME="right"
fi

echo "Fetching latest QMK build for Iris..."
RUN_DATA=$(gh run list --repo $REPO --workflow=build-qmk.yml --limit 1 --status completed --json databaseId,createdAt --jq '.[0]')
RUN_ID=$(echo "$RUN_DATA" | jq -r '.databaseId')
BUILD_TIME_UTC=$(echo "$RUN_DATA" | jq -r '.createdAt')

if [ -z "$RUN_ID" ] || [ "$RUN_ID" = "null" ]; then
    echo "No completed builds found"
    exit 1
fi

# Convert UTC to local time
BUILD_TIME_LOCAL=$(date -d "$BUILD_TIME_UTC" "+%Y-%m-%d %H:%M:%S %Z")

echo "Build completed: $BUILD_TIME_LOCAL"
echo "Downloading firmware..."
rm -rf /tmp/qmk-flash
gh run download $RUN_ID --repo $REPO --name Firmware --dir /tmp/qmk-flash

# Find the firmware file (.hex or .bin)
FIRMWARE=$(find /tmp/qmk-flash -name "*.hex" -o -name "*.bin" | head -1)

if [ -z "$FIRMWARE" ]; then
    echo "Firmware file not found"
    exit 1
fi

echo "Found firmware: $(basename $FIRMWARE)"
echo "Connect $SIDE_NAME side and press Enter to flash..."
read -p "Press Enter when ready..."

# Flash using QMK CLI
qmk flash "$FIRMWARE"

echo "$SIDE_NAME side flashed successfully!"

rm -rf /tmp/qmk-flash
