# Graphite Keybinding System — Propositional Logic Formalization

Full L0–L7 formalization of the cross-tool Graphite keybinding system.
Run `/propositional-logic:formalize` on any config file listed here to
re-derive or extend this analysis.

## L0: Inventory

| # | Tool | Input | Action | Target |
|---|------|-------|--------|--------|
| 1 | nvim | `h/a/e/i` | navigate | cursor |
| 2 | nvim | `x` | delete | text |
| 3 | nvim | `c` | yank | text |
| 4 | nvim | `v` | paste | text |
| 5 | nvim | `r_` | inner | text object |
| 6 | nvim | `t_` | around | text object |
| 7 | nvim | `z` | undo | edit |
| 8 | nvim | `Z` | redo | edit |
| 9 | snacks | `r` | create | file |
| 10 | snacks | `x` | delete | file |
| 11 | snacks | `R` | rename | file |
| 12 | snacks | `c` | copy | file |
| 13 | snacks | `h/i` | collapse/expand | tree |
| 14 | yazi | `h/a/e/i` | navigate | list |
| 15 | yazi | `x` | delete | file |
| 16 | yazi | `X` | delete permanent | file |
| 17 | yazi | `r` | create | file |
| 18 | yazi | `R` | rename | file |
| 19 | yazi | `c` | yank | file |
| 20 | yazi | `v` | paste | file |
| 21 | yazi | `u` | undo | file op |
| 22 | yazi | `s` | visual | selection |
| 23 | yazi | `r_`/`t_` | copy-path/toggle | meta ops |
| 24 | yazi | `d` | noop | blocked default |
| 25 | kitty | `C+haei` | focus | window |
| 26 | kitty | `AC+haei` | resize | window |
| 27 | kitty | `CS+ae` | scroll | page |
| 28 | kitty | `C+t` | new | tab |
| 29 | kitty | `C+w` | close | pane/tab/window |
| 30 | kitty | `C+pgdn/pgup` | switch | tab |
| 31 | hyprland | `S+arrows` | focus | window |
| 32 | hyprland | `SA+L/R` | switch | workspace |
| 33 | hyprland | `SC+arrows` | move | window |

## L1: Grouping

**G1: Navigation (HAEI)** — 1, 14, 25, 26, 31, 32, 33
Property: directional movement using Graphite positions

**G2: File Operations** — 9–12, 15–20, 23
Property: CRUD on files/entries

**G3: Text Operations** — 2–8
Property: edit actions on text content

**G4: Window Management** — 25–33
Property: control of window/pane/workspace layout

**G5: Undo/State** — 7, 8, 21
Property: reversing previous actions

Cross-group: `r_`/`t_` prefix (5, 6, 23) — text objects in nvim, meta ops in yazi

## L2: Primitives

```
Modifiers:   C = Ctrl    A = Alt    S = Super/Shift    CS = Ctrl+Shift
Directions:  D = {h=left, a=down, e=up, i=right}
Actions:     N=navigate  F=focus  X=delete  R=create  M=move
             Y=yank  V=paste  U=undo  W=rename  O=open  Q=close  Z=redo
Targets:     w=window  p=pane  t=tab  ws=workspace  f=file  tx=text
Prefixes:    r_=inner  t_=around  p_=path  g_=goto  f_=find  S_=ssh
```

## L3: Assertions

### G1: Navigation
```
D           => (N, cursor/list, D)        nvim, yazi
C + D       => (F, w, D)                  kitty
A + C + D   => (resize, w, D)             kitty
S + arrows  => (F, w, D)                  hyprland
S + A + L/R => (N, ws, D)                 hyprland
S + C + D   => (M, w, D)                  hyprland
```

### G2: File Operations
```
r     => (R, f, new)         snacks, yazi    CONSISTENT
x     => (X, f, trash)       snacks, yazi    CONSISTENT
X     => (X, f, permanent)   yazi
R     => (W, f, name)        snacks, yazi    CONSISTENT
c     => (Y, f, clipboard)   snacks, yazi    CONSISTENT
v     => (V, f, here)        yazi
```

### G5: Undo — INCONSISTENCY (documented exception)
```
z     => (U, tx, step)       nvim    key = z
u     => (U, f, step)        yazi    key = u  (z=zoxide conflict)
```

### Prefix collision — CROSS-DOMAIN (acceptable)
```
r_    => (inner, text-obj)   nvim    scope selector
r_    => (copy, path-meta)   yazi    extract info (redundant with p_)
t_    => (around, text-obj)  nvim    scope selector
t_    => (toggle, selection) yazi    bulk toggle
```

## L4: Modifier Semantics

### G1: Navigation
```
bare      => navigate in context
+C        => focus across boundaries (windows)
+A+C      => resize boundary
+S (hypr) => scope: window management
+S+A      => scope: workspace
+S+C      => action: move (vs focus)
```

### G2: File ops (single keys)
```
bare       => primary action
+Shift     => intensified variant
```
Rule: Shift(key) = intensify(action)

## L5: Composable Matrix

### File Operations
```
              bare         +Shift
create       r            R (rename)
delete       x            X (permanent)
copy         c            —
paste        v            V (force)
```

### Navigation
```
              bare D       +C D          +A+C D
nvim         cursor       (to kitty)    (to kitty)
yazi         list         (to kitty)    (to kitty)
kitty        —            focus win     resize win
```

### Undo
```
              bare         +Shift
nvim         z (undo)     Z (redo)
yazi         u (undo)     — (no redo)
```

## L6: Reduction

**Derivable from rules:**
- yazi `x`/`X` — follows Shift-intensify rule
- yazi `r`/`R` — follows Shift-intensify rule
- kitty `C+D` / `AC+D` — follows modifier escalation

**Redundant (remove candidate):**
- yazi `r_` prefix (rp, rf) — duplicated by `p_` prefix (pp, pf, pn)

**Exceptions (with rationale):**
- yazi `u` for undo — `z` taken by zoxide (high-frequency nav)
- yazi `d` noop — prevents accidental default delete
- yazi `t_` for toggles — no text objects in yazi, no real collision

## L7: Final System

### Primitives
```
D = {h, a, e, i}    C = Ctrl    A = Alt    S = Shift (case)
```

### Rules
```
1. bare + D       => navigate in context
2. C + D          => focus across boundaries
3. A + C + D      => resize boundaries
4. bare letter    => primary action
5. Shift(letter)  => intensified variant
6. prefix + key   => scoped operation
```

### Exceptions
```
1. u vs z for undo    yazi z=zoxide, nvim z=undo
2. d blocked          yazi prevents default delete
3. r_ prefix overlap  nvim=inner, yazi=path (redundant with p_)
```
