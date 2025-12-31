# Keylogme-Zero Data Structure

## Installation

### 1. Download binary
Downloaded from https://github.com/keylogme/keylogme-zero/releases

Installed to `~/.local/bin/keylogme-zero`

### 2. Find keyboard device IDs
```bash
lsusb
# Bus 003 Device 003: ID cb10:1756 Keebio Iris LM-K Rev. 1
```

### 3. Create config
Config location: `~/.keylogme/config.json`

```json
{
  "keylog": {
    "devices": [
      {
        "device_id": "1",
        "name": "keebio-iris",
        "keylogger": {
          "product_id": "0x1756",
          "vendor_id": "0xcb10"
        },
        "layers": []
      }
    ],
    "shortcut_groups": [],
    "shift_state": {
      "threshold_auto": "5ms"
    },
    "security": {
      "baggage_size": 500,
      "ghosting_codes": []
    }
  },
  "storage": {
    "file_output": "/home/yuv/.keylogme/output.json",
    "periodic_save": "20s"
  }
}
```

### 4. Add user to input group
```bash
sudo usermod -aG input $USER
# Log out and back in for group change to take effect
```

### 5. Run
```bash
CONFIG_FILE=~/.keylogme/config.json keylogme-zero
```

Or create a systemd user service for auto-start.

---

## Output Location
`~/.keylogme/output.json`

## JSON Structure

```json
{
  "keylogs": {
    "<device_id>": {
      "<layer>": {
        "<linux_keycode>": <press_count>
      }
    }
  },
  "shift_states": {
    "<device_id>": {
      "<shift_keycode>": {
        "<key_pressed>": <count>
      }
    }
  },
  "shift_states_auto": {
    // same structure - auto-detected shift combos
  }
}
```

## Field Descriptions

| Field | Description |
|-------|-------------|
| `device_id` | Configured device (e.g., "1" = Iris keyboard) |
| `layer` | OS-level layer, typically "0" (not firmware layers) |
| `linux_keycode` | Linux input event code (see mapping below) |
| `shift_keycode` | 42 = LSHFT, 54 = RSHFT |

## Common Linux Keycodes

| Code | Key | Code | Key | Code | Key |
|------|-----|------|-----|------|-----|
| 1 | ESC | 28 | ENTER | 57 | SPACE |
| 14 | BSPC | 29 | LCTRL | 42 | LSHFT |
| 15 | TAB | 56 | LALT | 54 | RSHFT |
| 16-25 | Q-P | 30-38 | A-L | 44-50 | Z-M |
| 103 | UP | 105 | LEFT | 106 | RIGHT |
| 108 | DOWN | 102 | HOME | 107 | END |

## Sample Data (2025-12-30)

Top key presses:
```
BSPC           486
SPACE          255
T              132
A              123
LCTRL          106
E              104
O               88
LSHFT           85
S               82
ENTER           78
```

## Observations

- **LSHFT (42)** used significantly more than **RSHFT (54)** - only 2 presses on right shift
- High backspace count may indicate typing errors or editing patterns
- Data confirms left-hand bias for modifiers

## App Integration Ideas

To use this data in a VIA-style app:
1. Map Linux keycodes to physical key positions
2. Normalize counts to 0-1 range for heatmap colors
3. Overlay on keyboard SVG visualization
