#!/bin/bash

set -e

if [ "$1" != "l" ] && [ "$1" != "r" ]; then
    echo "Usage: $0 <l|r>"
    echo "  l - flash left side"
    echo "  r - flash right side"
    exit 1
fi

SIDE="$1"
REPO="3dyuval/corne-zmk-config"

if [ "$SIDE" = "l" ]; then
    FIRMWARE="corne_left nice_view_adapter nice_view-nice_nano_v2-zmk.uf2"
    SIDE_NAME="left"
else
    FIRMWARE="corne_right nice_view_adapter nice_view-nice_nano_v2-zmk.uf2"
    SIDE_NAME="right"
fi

echo "Fetching latest build for $SIDE_NAME side..."
RUN_DATA=$(gh run list --repo $REPO --limit 1 --status completed --json databaseId,createdAt --jq '.[0]')
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
rm -rf /tmp/zmk-flash
gh run download $RUN_ID --repo $REPO --name firmware --dir /tmp/zmk-flash

if [ ! -f "/tmp/zmk-flash/$FIRMWARE" ]; then
    echo "Firmware file not found: $FIRMWARE"
    exit 1
fi

echo "Looking for bootloader drive..."

# Check by label first
LABEL_PATH=$(ls /dev/disk/by-label/*NANO* 2>/dev/null | head -1)
if [ -n "$LABEL_PATH" ]; then
    # Mount it if not already mounted
    DEVICE=$(readlink -f "$LABEL_PATH")
    MOUNT_POINT="/tmp/nicenano-mount"
    mkdir -p "$MOUNT_POINT"
    if ! mountpoint -q "$MOUNT_POINT"; then
        mount "$DEVICE" "$MOUNT_POINT" 2>/dev/null || true
    fi
    DRIVE="$MOUNT_POINT"
fi

# Fallback to searching mount points
if [ -z "$DRIVE" ]; then
    DRIVE=$(find /media/$USER /mnt -name "*NANO*" -o -name "*RPI-RP2*" 2>/dev/null | head -1)
fi

if [ -z "$DRIVE" ]; then
    echo "No bootloader drive found. Put $SIDE_NAME side in bootloader mode."
    read -p "Press Enter when ready..."
    LABEL_PATH=$(ls /dev/disk/by-label/*NANO* 2>/dev/null | head -1)
    if [ -n "$LABEL_PATH" ]; then
        DEVICE=$(readlink -f "$LABEL_PATH")
        MOUNT_POINT="/tmp/nicenano-mount"
        mkdir -p "$MOUNT_POINT"
        mount "$DEVICE" "$MOUNT_POINT" 2>/dev/null || true
        DRIVE="$MOUNT_POINT"
    fi
fi

if [ -z "$DRIVE" ]; then
    echo "Still no drive found. Check connection."
    exit 1
fi

echo "Found drive: $DRIVE"
echo "Will flash: $FIRMWARE"
read -p "Continue? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Flashing $SIDE_NAME side..."
    cp "/tmp/zmk-flash/$FIRMWARE" "$DRIVE/"
    sync
    echo "$SIDE_NAME side flashed successfully!"
else
    echo "Cancelled"
fi

rm -rf /tmp/zmk-flash