# Asset Brief — Level 3: Lizard Whack-a-Mole

## Gameplay TL;DR

A 3×3 grid of cactus pots fills the canvas. Lizards pop out of pots, the player taps them before they retreat. A rare "gold" lizard variant is worth more. The game's score, miss counter and timer are in the HUD.

## Canvas + palette

- Logical canvas **1280×720**.
- Background today is a flat dusk purple (`#2f1b3c`) — the new background should keep that nighttime/dusk-fair vibe so the pots and lizards pop.
- Style and palette follow the master brief.

## Assets

### 3.1 Background

Replaces the flat purple field.

- **Logical size:** **1280 × 720**, full canvas, single image (no parallax).
- **Deliver:** PNG, opaque.
- **Variants:** 1.
- **Style:** desert fairground / carnival at dusk works well — a low horizon line, dusky sky above, sand or wooden-deck floor below. Avoid clutter in the central area where the pots sit (8% horizontal padding, 18% vertical padding from canvas edges). Slight vignette helps focus.
- **Naming:** `game3-background.png`.

### 3.2 Pot (no lizard)

The "empty" pot — sits in every grid slot continuously, lizards rise out of it.

- **Logical render size:** **110 px** square (pot diameter at the top).
- **Deliver:** PNG with alpha at **220×220** OR SVG. PNG preferred so it can carry texture (terracotta cracks, soil rim).
- **Variants:** **1**, clan-agnostic. Designer's choice if multiple pot designs would add variety — happy with 1 or 2–3 alternates rendered randomly.
- **Style:** classic terracotta pot with a top rim of dark soil. The mouth of the pot is where the lizard emerges from — leave the centre top dark/recessed so lizards "rise out of" something that reads as a hole.
- **Naming:** `pot.png`.

### 3.3 Pot + lizard (common variant)

The pot with a lizard sticking out of the mouth, ready to whack.

- **Logical render size:** **96 px** for the lizard (the pot can sit at its 110 px size beneath/behind it, OR be combined into a single 110-ish-px composite).
- **Deliver:** Two options — designer's choice:
  - **Option A (preferred):** lizard PNG (alpha) separate from the pot, so the game can tween it rising. **96×96 logical, deliver 192×192.**
  - **Option B:** composite pot+lizard PNG at 220×220 (alpha), with the matching empty-pot from 3.2 used in the gap. We'd swap whole sprites between states.
- **Variants:** **1** (the common / "green" lizard). Friendly cartoon desert lizard, head and shoulders emerging from the pot mouth, eyes visible, mouth in a slight grin.
- **Naming:** `lizard-up.png` (Option A) or `pot-lizard-green.png` (Option B).

### 3.4 Pot + lizard (rare "gold" variant)

The bonus lizard — currently red in the placeholder ("bandit"), worth more points. The user's spec calls for a gold variant; either reading works.

- **Logical render size:** same as 3.3 (96 px lizard, optionally combined with 110 px pot).
- **Deliver:** same format as 3.3.
- **Variants:** **1** — same lizard pose as the common variant but in a premium palette. Recommend **gold/amber** (matches the rest of the game's golden-accent treatment) with maybe a small crown, sunglasses, gem, or sash to read as "rare". Designer's call on flair.
- **Naming:** `lizard-bandit.png` (existing manifest key) or `lizard-gold.png` — confirm with the dev when delivering and we'll wire whichever name lands.

> Style consistency: the rare lizard should be unmistakable at a glance, even peripheral vision. The player has ~1.1 s to decide whether to tap it.

### 3.5 Splat / hit effect (optional)

A brief burst that appears where the lizard was tapped. Today it's an SVG `hit.splat`.

- **Logical render size:** 96 px.
- **Deliver:** PNG with alpha at 192×192 OR SVG.
- **Variants:** 1.
- **Style:** cartoon "POW" burst, dust cloud, or sparkle ring. Quick read, no gore (family-friendly).
- **Naming:** `hit-splat.png`. (Optional — the procedural placeholder is fine for v1.)

## State + animation notes

- Lizards tween scale 0.2 → 1.0 over 180 ms as they rise, hold ~1.1 s, then shrink back if missed. A **single pose** (head/shoulders out, neutral expression) is all that's needed — no separate "rising" vs "up" frame.
- The score, miss counter, and floating "+points" text are rendered as code text, no art needed.
- All sprites: transparent alpha, no baked shadow.

## Delivery checklist

- [ ] 1 × background PNG (1280×720).
- [ ] 1 × pot PNG (220×220) — or 2–3 variants for variety.
- [ ] 1 × common lizard PNG (192×192).
- [ ] 1 × rare/gold lizard PNG (192×192).
- [ ] Optional: 1 × splat PNG (192×192).
