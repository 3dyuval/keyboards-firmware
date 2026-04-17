# Firmware Build Guide

## Local Build (ZMK)

### 1. System dependencies

```bash
# Arch / CachyOS
sudo pacman -S --needed cmake ninja python dtc git wget

# Python tooling
pip install --user west
```

### 2. Zephyr SDK

Download and install the [Zephyr SDK](https://github.com/zephyrproject-rtos/sdk-ng/releases/latest).
Pick the minimal bundle for ARM (`zephyr-sdk-*_linux-x86_64_minimal.tar.xz`) plus the ARM toolchain.

```bash
cd ~
wget https://github.com/zephyrproject-rtos/sdk-ng/releases/download/<version>/zephyr-sdk-<version>_linux-x86_64_minimal.tar.xz
tar xf zephyr-sdk-*.tar.xz
cd zephyr-sdk-*/
./setup.sh -t arm-zephyr-eabi
```

### 3. ZMK workspace

Initialize a ZMK workspace **outside** this repo, then point it at this repo as the config module.

```bash
mkdir ~/zmk-workspace && cd ~/zmk-workspace
west init -l /home/yuv/keyboards-firmware
west update
west zephyr-export
pip install --user -r zephyr/scripts/requirements.txt
```

### 4. Build firmware

Run from inside `~/zmk-workspace`. Replace `<artifact-name>` with the values from `build.yaml`.

```bash
# TOTEM left
west build -b xiao_ble//zmk -d build/totem-left -- \
  -DSHIELD="totem_left" \
  -DSNIPPET="studio-rpc-usb-uart"

# TOTEM right
west build -b xiao_ble//zmk -d build/totem-right -- \
  -DSHIELD="totem_right"

# Corne left
west build -b nice_nano//zmk -d build/corne-left -- \
  -DSHIELD="corne_left nice_view_adapter nice_view"

# Corne right
west build -b nice_nano//zmk -d build/corne-right -- \
  -DSHIELD="corne_right nice_view_adapter nice_view"

# Eyelash left
west build -b eyelash_corne_left -d build/eyelash-left -- \
  -DSHIELD="nice_view"

# Eyelash right
west build -b eyelash_corne_right -d build/eyelash-right -- \
  -DSHIELD="nice_view"
```

Output `.uf2` is at `build/<name>/zephyr/zmk.uf2`. Copy to the keyboard's USB drive to flash.

### Incremental rebuilds

After editing `config/` files, just re-run the same `west build` command — west only recompiles what changed.

---

## GitHub Actions Build

<!-- TODO -->
