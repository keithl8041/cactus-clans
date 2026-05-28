# Asset Brief — Level 8: Desert Dash (Boss Finale)

## Gameplay TL;DR

Two-phase finale. **Phase 1 (running):** auto-scrolling sprint to the right, jumping/double-jumping over rocks and cactus spikes, collecting stars. **Phase 2 (boss):** the world stops scrolling, the player gets free movement across the full canvas, and a giant Sand Tarantula appears. Stomp the boss three times — telegraphing-then-leap, spit, and rolling-cactus attacks — to win the journey.

## Canvas + palette

- Logical canvas **1280×720**.
- Background today is sunset purple (`#6a3a5a`) — keep that dramatic-finale palette.

## Assets

### 8.1 Background (running phase)

Parallax desert backdrop for the sprint.

- **Logical size:** each layer **1280 × 720**, **tileable horizontally**.
- **Deliver:** PNGs.
- **Layers (3 total):**
  - **Far** — sunset horizon, distant mountains, dramatic sky (purple/orange). Opaque. Scrolls at 12%.
  - **Mid** — closer dunes, larger cacti silhouettes. Transparent above the dune line. 35% scroll.
  - **Near** — foreground sand mounds, sparse desert detail. Transparent above its silhouette. 85% scroll.
- **Variants:** 1 of each layer.
- **Naming:** `game8-parallax-far.png`, `game8-parallax-mid.png`, `game8-parallax-near.png`.
- **Style:** **darker, more dramatic than Level 2's daytime parallax** — this is the finale. Sunset → blue hour palette. The level can transition into the boss phase by simply stopping the scroll, so make sure the far layer reads as a "fight backdrop" when static.

### 8.2 Floor strip

Tan ground for the running phase.

- **Logical size:** **1280 × 60 px**, tileable.
- **Deliver:** PNG, opaque.
- **Variants:** 1. Slightly warmer / sunset-tinged version of the Level 2 floor.
- **Naming:** `game8-floor.png`.

### 8.3 Rock (obstacle)

- **Status:** **reuse from Level 2** (`rock.svg`). No new delivery needed unless the designer wants a sunset-tinted variant for this level — defer-able polish.

### 8.4 Cactus (obstacle, 2–3 variants)

The runner jumps over these. The user explicitly asked for variety here.

- **Logical render size:** **80 px** tall.
- **Deliver:** PNG with alpha at **160×160** OR SVG. SVG preferred.
- **Variants:** **2–3 silhouettes** — same family, different outlines (e.g. tall single-stem, classic Saguaro with arms, a low cluster). Designer's discretion. Helps the runner phase feel less repetitive over a 60+ second run.
- **Style:** standing desert cactuses, opaque silhouettes, clan-agnostic. Visibly different from the Level 1 `cactus-spike` (which is a single pointing spike) — these are full plants the player jumps over.
- **Naming:** `cactus-prop-a.png`, `cactus-prop-b.png`, `cactus-prop-c.png`.

### 8.5 Star (collectible)

- **Status:** **already exists** — gold bonus star from Level 1, `star.svg`. Reuse, no new delivery required.

### 8.6 Big boss Sand Tarantula

The level's centrepiece. Same family as the Level 5 tarantula but **giant** and more menacing.

- **Logical render size:** **180 px** wide (over 2× the Level 5 tarantula).
- **Deliver:** PNG with alpha at **360×360** (@2×). @3× welcome — this is a hero asset.
- **Variants:** **1 sprite**, clan-agnostic.
- **Pose:** **side view, facing left** (toward the player). The boss telegraphs, leaps, lands, skitters back, spits, and lobs cacti — all motion is **code-driven** (tweens, position changes, no frame animation). A single dramatic side pose is correct.
- **Style:** family-friendly menace. Bigger, fuzzier, fiercer relative of the Level 5 tarantula — **must look like the same species, scaled up + decorated**. Add a touch of "boss" flair: a small chitin crest, golden eye markings, sand-coloured highlights to read as a "Sand Tarantula" (not just "spider").
- **Naming:** `boss-tarantula.png`.

> Designer note: keep the silhouette readable from across the room. The boss is a single visual element at a time, with the player learning to spot its rear-up "telegraph" pose — but again, the telegraph is done by code (rotation + Y offset). One pose is enough.

### 8.7 Boss attack: spike spit

The boss spits projectiles at the player.

- **Status:** **reuse `cactus-spike.png`** (Level 1) at 56 px. The projectile travels leftward and arcs slightly — visually a flung spike.
- No new delivery unless the designer wants a wet/sandy "spit" variant — defer-able.

### 8.8 Boss attack: rolling cactus

The boss lobs a cactus that arcs up, lands, then rolls along the ground.

- **Logical render size:** **60 px**.
- **Deliver:** PNG with alpha at **120×120** OR SVG.
- **Variants:** **1 sprite**, clan-agnostic. **Roughly round / barrel-shaped** so it reads as a rolling object. Designer can reuse a small `cactus-prop` design or make a dedicated chubby cactus.
- **Naming:** `cactus-rolling.png`.

### 8.9 Boss health bar (HUD)

Three-segment bar at the top of the screen during the boss phase.

- **Logical size:** **220 × 16 px**.
- **Deliver:** **SVG preferred** — the frame, the three segment dividers, and a small "BOSS" or skull icon label. The fill is code-drawn (green, depletes per stomp).
- **Variants:** 1.
- **Style:** ornate wooden / bone frame, fits the desert-finale vibe. Don't fill it in art — code does the fill.
- **Naming:** `boss-health-bar.svg`.

### 8.10 Heart / lives icon

Player's lives, shown top-right during the running phase.

- **Status:** **shared with Level 7** — see Level 7 brief Section 7.9. Single `heart.svg` covers both levels.

### 8.11 Jump button

A circular tap target in the bottom-right corner during the running phase.

- **Logical render size:** **112 px** diameter (56 px radius).
- **Deliver:** PNG with alpha at **224×224** OR SVG.
- **Variants:** 1 (optionally a pressed/active state — code can dim it instead).
- **Style:** circular button, gold rim, an upward-arrow or "JUMP" glyph in the centre. Sits over the running layer so it must be **legible against any of the parallax variants** — strong outline / drop shadow helps.
- **Naming:** `button-jump.png`.

### 8.12 Finish banner

- **Status:** **reuse from Level 2** (`finish-banner.png`). No new delivery required.

### 8.13 Character (form 8 lock, per clan)

Player avatar, front-facing during running and boss phases.

- **Form lock:** the character in this level is always **Form 8** (the clan boss / final form) of the player's selected clan, regardless of their actual progression. Reuses the existing `character-<clan>-form8.png` sprites from the master brief pipeline — no new character art required here.
- **Status:** already in the asset pipeline (see master brief, Section 3.1). No new delivery required for this level.

## State + animation notes

- The player **jumps and double-jumps** via code physics — no jump-pose sprite needed. The existing standing character is fine.
- The boss has multiple substates (idle, telegraph, leap, landed, returning, spit, lob) but all are code tweens applied to **one static sprite**. No frame animation needed.
- Obstacles fade on hit, stars scale-fade on collection — all code-driven.

## Delivery checklist

- [ ] 3 × parallax layer PNGs (1280×720, tileable).
- [ ] 1 × floor strip (1280×60, tileable).
- [ ] 2–3 × cactus prop sprites (160×160 each).
- [ ] **1 × big boss tarantula PNG (360×360)** — the hero asset.
- [ ] 1 × rolling cactus sprite (120×120).
- [ ] 1 × boss health bar SVG (220×16 frame).
- [ ] 1 × jump button (224×224).

Reused from elsewhere: `rock.svg` (Level 2), `cactus-spike.png` (Level 1), `star.svg` (Level 1), `heart.svg` (shared with Level 7), `finish-banner.png` (Level 2), per-clan character sprites (master brief).
