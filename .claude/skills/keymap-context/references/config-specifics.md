# Config Specifics

Per-tool binding details and known exceptions for the Graphite keybinding system.

## Mod-Morphs (graphite.dtsi)

### BASE layer (punctuation overrides)
- `comma_morph`: COMMA / COLON (shift)
- `dot_morph`: DOT / SEMICOLON (shift)
- `qmark_morph`: QMARK / EXCL (shift)
- `quote_morph`: SQT / GRAVE (shift)
- `plus_morph`: PLUS / EQUAL (GUI)

### NUM layer (shift merges NUM → SYM)
Standard keycodes already give shift+number = symbol (shift+1=!, shift+2=@, etc.).
These mod-morphs cover the operator keys where the standard shifted value
doesn't match the SYM layer equivalent at the same position:

- `star_morph`: ASTRK / COLON (shift) — `*` position matches `:` on SYM
- `slash_morph`: FSLH / BSLH (shift) — `/` position matches `\` on SYM
- `n3_morph`: N3 / DOT (shift) — decimal point for numpad (overrides standard `#`)

## Kitty

- `kitty_mod` = `ctrl+shift`
- `C+haei` = focus window (passthrough to nvim when `IS_NVIM`)
- `AC+haei` = resize window (passthrough to nvim when `IS_NVIM`)
- `CS+ae` = scroll page up/down
- `C+t` = new tab, `C+w` = smart close (pane > tab > window)
- `C+pgdn/pgup` = switch tabs
- `CS+y` = focus nvim pane, `CS+k` = focus claude pane

## Hyprland

- `SUPER+arrows` = focus window
- `SUPER+ALT+L/R` = workspace switch
- `SUPER+CTRL+arrows` = move window
- `SHIFT+arrows` = FREE (no conflict with mod-morphs)

## Neovim

### Navigation (Graphite HAEI)
- `h/a/e/i` = left/down/up/right (replaces hjkl)
- `ga/ge` = scroll down/up
- `gh` = go to bottom (G)
- `p` = first non-blank (^), `.` = end of line ($)

### Operations
- `x` = delete, `c` = yank, `v` = paste
- `z` = undo, `Z` = redo
- `r_` = inner text object, `t_` = around text object

### Snacks Explorer File Ops
- `r` = create, `x` = delete, `R` = rename
- `c` = copy, `h` = collapse, `i` = expand
- `d` = disabled (blocked default)

## Yazi

### Navigation (Graphite HAEI)
- `h` = parent, `a` = down, `e` = up, `i` = enter
- `aa` = bottom, `ee` = top
- `A-a/A-e` = jump 5

### File Ops (aligned with snacks)
- `r` = create, `x` = delete, `X` = permanent delete, `R` = rename
- `c` = yank, `v` = paste, `V` = force paste
- `u` = undo (not `z` — z=zoxide)
- `d` = noop (blocked default)

### Prefixes
- `p_` = copy path ops (pp=path, pf=name, pn=dir)
- `g_` = goto (gh=home, gd=downloads, gs=git changes)
- `f_` = find/search (fz=grep, fd=dirs, ff=files)
- `S_` = sshfs (Ss=menu, Sm=mount, Su=unmount)
- `t_` = toggle (ta=select all, tn=deselect all)
- `m_` = linemode (default: ms=size, mm=mtime, mp=permissions)

### Redundancy Note
`r_` prefix (rp, rf) duplicates `p_` prefix — candidate for removal.

## Walker

Config at `~/.config/walker/config.toml`. Launcher keybindings are
Hyprland-triggered (SUPER+space or similar), internal nav follows
GTK/readline conventions.
