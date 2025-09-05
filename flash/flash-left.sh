#!/bin/bash

set -e

REPO="3dyuval/corne-zmk-config"
FIRMWARE="corne_left-nice_nano_v2-zmk.uf2"

echo "Fetching latest build..."
RUN_ID=$(gh run list --repo $REPO --limit 1 --status completed --json databaseId --jq '.[0].databaseId')

if [ -z "$RUN_ID" ]; then
    echo "No completed builds found"
    exit 1
fi

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
    echo "No bootloader drive found. Put left side in bootloader mode."
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
    echo "Flashing left side..."
    cp "/tmp/zmk-flash/$FIRMWARE" "$DRIVE/"
    sync
    echo "Left side flashed successfully!"
else
    echo "Cancelled"
fi

rm -rf /tmp/zmk-flash