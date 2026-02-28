---
name: Keymap Context
description: >
  This skill should be used when the user asks to "change a layer",
  "move a key", "add a mod-morph", "fix shift", "update the keymap",
  "flash firmware", "draw keymaps", or works on ZMK keymap layout design
  across keyboards. Provides design motivation, file locations, and constraints.
---

# Keymap Context

## System Overview

Graphite layout flows from physical keyboard through every tool. Three rules govern all bindings:

```
D = {h=left, a=down, e=up, i=right}     Navigation directions

1. bare + D       => navigate in context     (cursor, list, tree)
2. C + D          => focus across boundaries  (kitty windows)
3. Shift(key)     => intensify same action    (x=trash, X=permanent)
```

File operations are consistent across nvim snacks explorer and yazi:

```
          bare     +Shift
create    r        R (rename)
delete    x        X (permanent)
copy      c        —
paste     v        V (force)
```

Prefixes scope operations: `g_`=goto, `f_`=find, `p_`=path, `S_`=ssh, `t_`=toggle

Exception: undo is `z` in nvim, `u` in yazi (z=zoxide conflict).

## Config Files

### Keyboard Firmware

- Shared layout: `config/graphite.dtsi`
- Corne keymap (36-key): `config/corne.keymap`
- Totem keymap (38-key): `config/totem.keymap`
- Eyelash keymap (42-key): `boards/eyelashperipherals/eyelash_corne/eyelash_corne.keymap`
- Eyelash board DTS: `boards/eyelashperipherals/eyelash_corne/eyelash_corne.dtsi`
- Build matrix: `build.yaml`
- Flash script: `scripts/fw.ab` (Amber lang)
- Draw keymaps: `scripts/draw-keymaps.sh`
- CI workflows: `.github/workflows/build-zmk.yml`, `.github/workflows/draw-keymap.yml`

### Host System

- Hyprland bindings: `~/.local/share/omarchy/config/hypr/bindings.conf`
- Kitty terminal: `~/.config/kitty/kitty.conf`
- Walker launcher: `~/.config/walker/config.toml`

### Applications

- Neovim keymaps: `~/.config/nvim/lua/config/keymaps.lua`
- Neovim snacks explorer: `~/.config/nvim/lua/plugins/snacks.lua` (`sources.explorer.win.list.keys`)
- Yazi keymap: `~/.config/yazi/keymap.toml`

## ZMK Constraints

- Mod-morphs only respond to real modifiers (SHIFT, CTRL, ALT, GUI), not layer state
- Tap-dance adds delay (tapping-term) — bad for shift/space
- Hold-tap `balanced` flavor works well for thumb keys (sym_ht, ralt_num_ht)
- NUM layer activated by right thumb hold — right hand BSPC unreachable while in NUM
- Settings reset must match board (eyelash needs its own, not nice_nano's)
- Eyelash has encoder + joystick occupying middle matrix positions

## Keyboard Design

- Three key counts: 36-key (Corne), 38-key (Totem), 42-key (Eyelash Corne)
- Layers: BASE(0), NUM(1), SYM(2), SYS(3)
- Shift mod-morphs merge layers (shift+number = symbol, shift+punctuation = alternate)
- Left thumb: CTRL (hold/ESC tap), SYM layer, SPACE
- Right thumb: RET, BSPC, NUM/RALT hold-tap
- Shift keys on bottom alpha row (row 2), not home row
- Outer columns on 42-key: `&none` on rows 0-1, shift on row 2

## Commands

- `./scripts/fw.ab f <keyboard> <side> [-r]` — flash firmware (-r for settings reset)
- `./scripts/fw.ab s` — check CI build status
- `./scripts/draw-keymaps.sh [keyboard]` — render keymap SVGs

## References

- `references/config-specifics.md` — per-tool binding details, mod-morphs, known exceptions
- `references/formalization.md` — full propositional logic formalization (L0–L7) of the cross-tool system
