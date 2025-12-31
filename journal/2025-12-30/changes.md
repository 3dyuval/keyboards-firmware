# Keymap Changes - 2025-12-30

## Motivation

Right hand strain - numbness in right index finger, likely caused by:
- Reaching for right shift on top row
- HAEI arrow navigation (all on right hand)
- Mouse usage

## Summary of Changes

### 1. Layer Renaming
- `FUN` → `FN1` (function keys)
- `SYS` → `FN2` (navigation/system)

### 2. Right Shift Relocation

**Before:** RSHFT on top-right corner (hard to reach)
**After:** RSHFT on bottom-right row

| Layout | Old Position | New Position |
|--------|--------------|--------------|
| 36-key | Row 1, Col 12 | Row 3, Col 12 |
| 42-key | Row 1, Col 13 | Row 3, Col 13 |

COMMA moved to top row (was on bottom row in 42-key).

### 3. Left-Hand Arrow Keys

Added arrow keys to LEFT hand on home row (NRTS positions) in both SYM and FN2 layers:

```
SYM Layer (left side row 2):
N → LEFT
R → UP
T → DOWN
S → RIGHT
```

This mirrors the right-hand arrows, giving redundant access for ergonomics.

### 4. FN2 Layer Access

**Before:** No easy thumb access to navigation layer
**After:** `&lt FN2 BSPC` on right thumb

- Tap = Backspace
- Hold = FN2 (navigation layer)

This allows one-handed arrow navigation with left hand while right thumb holds BSPC.

### 5. Mirrored Brackets (SYM Layer)

Opening brackets on LEFT hand, closing on RIGHT:

| Left Hand | Right Hand |
|-----------|------------|
| `!` EXCL  | `]` RBKT   |
| `[` LBKT  | `}` RBRC   |
| `{` LBRC  | `)` RPAR   |
| `(` LPAR  | `\` BSLH   |

### 6. Symbol Changes (42-key SYM)

- `%` PRCNT → moved to G position (left side)
- `#` HASH → moved to V position (left side, was `$`)
- `$` DOLLAR → kept on 36-key only

## Files Modified

- `config/graphite.dtsi` - Main layout definitions
- `config/corne.keymap` - 36-key layer references
- `config/eyelash_corne.keymap` - 42-key layer references

## Base Layer Layout (Current)

```
36-key:
ESC/GUI  B/FN2  L  D  W  Z  |  ;  F  O  U  J  RSHFT
TAB/FN1  N      R  T  S  G  |  Y  H  A  E  I  '
LSHFT    Q      X  M  C  V  |  K  P  .  -  /  ,
              LCTRL SYM SPC | RET BSPC/FN2 RALT

42-key (with joystick/encoder):
ESC/GUI  B/FN2  L  D  W  Z  [ENC]  ;  F  O  U  J  ,
TAB/FN1  N      R  T  S  G  [JOY]  Y  H  A  E  I  '
LSHFT    Q      X  M  C  V  [BTN]  K  P  .  -  /  RSHFT
              LCTRL SYM SPC      | RET BSPC/FN2 RALT
```

## Testing Notes

- [ ] Verify RSHFT is comfortable on bottom row
- [ ] Test left-hand arrows for vim navigation
- [ ] Monitor backspace/FN2 hold timing
- [ ] Check bracket workflow for coding
