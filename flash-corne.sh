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
RUN_DATA=$(gh run list --repo $REPO --workflow=build.yml --limit 1 --status completed --json databaseId,createdAt --jq '.[0]')
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

# First, check if already mounted in standard locations
DRIVE=$(find /media/$USER /mnt /run/media/$USER 2>/dev/null -maxdepth 2 -type d \( -name "*NANO*" -o -name "*RPI-RP2*" \) | head -1)

# If not found in standard mounts, check by device label
if [ -z "$DRIVE" ]; then
    echo "Not found in standard mount points, checking by label..."
    LABEL_PATH=$(find /dev/disk/by-label/ -name "*NANO*" -o -name "*RPI-RP2*" 2>/dev/null | head -1)
    
    if [ -n "$LABEL_PATH" ]; then
        DEVICE=$(readlink -f "$LABEL_PATH")
        echo "Found device: $DEVICE"
        
        # Check if it's already mounted somewhere else
        EXISTING_MOUNT=$(findmnt -n -o TARGET "$DEVICE" 2>/dev/null)
        if [ -n "$EXISTING_MOUNT" ]; then
            echo "Device already mounted at: $EXISTING_MOUNT"
            DRIVE="$EXISTING_MOUNT"
        else
            # Try to mount it ourselves
            MOUNT_POINT="/tmp/nicenano-mount"
            mkdir -p "$MOUNT_POINT"
            if mount "$DEVICE" "$MOUNT_POINT" 2>/dev/null; then
                echo "Mounted device at: $MOUNT_POINT"
                DRIVE="$MOUNT_POINT"
            else
                echo "Failed to mount device"
            fi
        fi
    fi
fi

# Verify the drive is accessible and writable
if [ -n "$DRIVE" ] && [ -d "$DRIVE" ] && [ -w "$DRIVE" ]; then
    echo "Drive verified: $DRIVE"
else
    echo "Drive not accessible or not writable: $DRIVE"
    DRIVE=""
fi

if [ -z "$DRIVE" ]; then
    echo "No bootloader drive found. Put $SIDE_NAME side in bootloader mode."
    read -p "Press Enter when ready..."
    
    # Retry the same detection logic
    DRIVE=$(find /media/$USER /mnt /run/media/$USER 2>/dev/null -maxdepth 2 -type d \( -name "*NANO*" -o -name "*RPI-RP2*" \) | head -1)
    
    if [ -z "$DRIVE" ]; then
        LABEL_PATH=$(find /dev/disk/by-label/ -name "*NANO*" -o -name "*RPI-RP2*" 2>/dev/null | head -1)
        if [ -n "$LABEL_PATH" ]; then
            DEVICE=$(readlink -f "$LABEL_PATH")
            EXISTING_MOUNT=$(findmnt -n -o TARGET "$DEVICE" 2>/dev/null)
            if [ -n "$EXISTING_MOUNT" ]; then
                DRIVE="$EXISTING_MOUNT"
            else
                MOUNT_POINT="/tmp/nicenano-mount"
                mkdir -p "$MOUNT_POINT"
                if mount "$DEVICE" "$MOUNT_POINT" 2>/dev/null; then
                    DRIVE="$MOUNT_POINT"
                fi
            fi
        fi
    fi
    
    # Verify again
    if [ -n "$DRIVE" ] && [ -d "$DRIVE" ] && [ -w "$DRIVE" ]; then
        echo "Drive found: $DRIVE"
    else
        DRIVE=""
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