# 2025-12-30 - Ergonomic Analysis: Right Hand Strain

## Symptoms

- Numbness in right hand, primarily index finger
- Suspected radial nerve involvement
- Triggered by: reaching for right shift, mouse, HAEI arrow navigation

## Right Hand Load Analysis

| Action            | Finger                   | Frequency       |
| ----------------- | ------------------------ | --------------- |
| `h` (left arrow)  | Right index              | Constant in vim |
| `a` (down arrow)  | Right index (reach down) | Very high       |
| `e` (up arrow)    | Right middle             | High            |
| `i` (right arrow) | Right ring               | High            |
| Mouse             | Whole hand               | All day         |
| Right Shift       | Right pinky (reach)      | Medium          |

### Right Index Specifically

- `H` key = left arrow
- `A` key = down arrow
- `Y`, `G` on same finger

## Possible Causes

### 1. Radial Nerve

- Runs along thumb-side of forearm, affects index
- Aggravated by:
  - Wrist extension (lifted wrist, like when mousing)
  - Pronation (palm-down position)

### 2. Repetitive Index Curling

- `h` and `a` are both index-heavy keys
- High frequency in vim navigation

### 3. Asymmetric Load

- Navigation is 100% right hand
- Coding/typing more balanced
- Mouse adds to right-hand dominance

## Considerations for 5x3 Layout

- [ ] Move some navigation to left hand (mirrored arrows on layer?)
- [ ] Reduce right-hand-only sequences
- [ ] Evaluate mouse hand situation
- [ ] Consider home row mods to reduce pinky reach for shift

## Questions to Explore

- Mouse hand: right? (doubles the load)
- Does numbness increase after vim navigation sessions vs general typing?
- Wrist position while mousing?

## Immediate Action

### Setup keymouse-logger

```bash
git clone https://github.com/njanirudh/keymouse-logger
cd keymouse-logger
pip install -r requirements.txt
python main.py  # run in background
```

### Hourly Check-in Protocol

Record feelings each hour while working:

| Time | Numbness (0-10) | Location | Activity prior | Notes |
| ---- | --------------- | -------- | -------------- | ----- |
|      |                 |          |                |       |
|      |                 |          |                |       |
|      |                 |          |                |       |
|      |                 |          |                |       |
|      |                 |          |                |       |

### What to Track

- Numbness/tingling intensity (0-10)
- Specific fingers affected
- What you were doing in the last 30 min (vim nav, typing, mousing, mixed)
- Wrist position observations
