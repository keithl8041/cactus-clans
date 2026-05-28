# Asset Brief — Level 6: Cactus Dart Toss

> Note on numbering: in chat we initially listed this as "level 2". The shipped order has **Camel Sprint = Level 2**, **Cactus Dart Toss = Level 6**. This file uses the shipped order.

## Gameplay TL;DR

Player stands on the left of the canvas with a finite quiver of cactus spikes. Drag-and-release (slingshot gesture) launches a spike at a dartboard on the right. Hit the bullseye for max points; outer rings score less. The dartboard shrinks and starts bobbing after a couple of hits.

## Canvas + palette

- Logical canvas **1280×720**.
- Background today is desert night (`#2a1a0c`) above and a tan floor strip (`#7a5a3a`, 12 px tall) below — keep that dusky carnival feel.

## Assets

### 6.1 Background

Replaces the flat dark-brown field.

- **Logical size:** **1280 × 720**, single image, opaque.
- **Deliver:** PNG.
- **Variants:** 1.
- **Style:** dusk desert, **a hint of carnival** — a low horizon, dusky sky with maybe distant lights/lanterns, no detail in the right-of-centre area where the dartboard sits at varying positions (62–92% canvas width, ~50% canvas height). The character stands at 22% width — leave that floor area clean too. Slight vignette to focus attention on the throwing arc.
- **Naming:** `game6-background.png`.

### 6.2 Floor strip

Tan ground the character stands on.

- **Logical size:** **1280 × 60 px**, tileable.
- **Deliver:** PNG, opaque.
- **Variants:** 1. If `game2-floor.png` exists from Level 2, **reuse it** and skip this — same dimensions, same vibe.
- **Naming:** `game6-floor.png` if delivering a new one, otherwise reuse.

### 6.3 Dartboard / target

The bullseye target the player aims at. Currently a procedural concentric-rings SVG.

- **Logical render size:** **140 px** base, but the game scales it down by 0.95× per successful hit (min 0.65×). Design at 140 px and the engine will scale it.
- **Deliver:** PNG with alpha at **280×280** OR SVG. **SVG preferred** since it scales without resampling artifacts.
- **Variants:** **1 sprite**, clan-agnostic.
- **Style:** classic dart target with **three visible scoring rings**:
  - Bullseye — innermost ~18% radius. Highest-value zone, gold/red.
  - Mid ring — out to ~45% radius.
  - Outer ring — out to ~95% radius.
  - The ring boundaries should be obvious so kids can see where their spike landed without checking the score.
  - **Hangable** — give it a small hook/string at the top so it reads as "hung on a post" not "floating". A wooden frame or rope edge looks great.
  - Mild desert flavour (woven straw, painted wood) but the target rings must dominate.
- **Naming:** `dartboard.png` or `dartboard.svg`.

> Designer note: when the dartboard is bobbing (after 2+ hits) the game tweens its Y position by code — no swing animation needed in the art.

### 6.4 Cactus spike (thrown projectile)

The dart the player launches.

- **Status:** **already exists** — `/art/cactus-spike.png`. Reuse, no new delivery required.
- The game rotates the spike at runtime so the **tip aligns with the velocity vector** (atan2 + 90°) — the existing single-orientation asset is perfect.
- The user's note: "might not change as the current one works quite well" — agreed; we'll keep this one unless the designer wants a thrown / "dart-fletched" variant. **Optional alternate:** a dart-style variant with feathers/flights at the back, naming `cactus-dart.png`. Defer unless desired.

### 6.5 Character (form 6 lock, per clan)

The thrower. Stands at 22% canvas width.

- **Form lock:** the character in this level is always **Form 6** of the player's selected clan (regardless of their actual progression). Reuses the existing `character-<clan>-form6.png` sprites from the master brief pipeline — no new character art required here.
- **Status:** already in the asset pipeline (see master brief, Section 3.1). No new delivery required for this level.

### 6.6 Spike stuck in board (optional)

After a hit, the spike "sticks" visually on the dartboard. Today it's the same spike sprite, rotated and frozen.

- **Status:** reuses the same `cactus-spike.png`. No new delivery.
- **Optional polish:** a "stuck spike" variant with a slight squish at the tip or a small impact dust puff sprite. Defer.

## State + animation notes

- The dartboard scaling, bobbing, and position changes are all done by code tweens — a single static asset is correct.
- The slingshot line and trajectory dots are code-drawn — no art needed.
- The character does **not** need a throwing animation; the existing idle sprite is what runs.

## Delivery checklist

- [ ] 1 × background PNG (1280×720).
- [ ] 1 × dartboard SVG (or PNG 280×280).
- [ ] Optional: 1 × dedicated `cactus-dart` variant.
- [ ] Floor strip — reuse Level 2's if already delivered.

Reused from elsewhere: `cactus-spike.png` (Level 1), per-clan character sprites (master brief).
