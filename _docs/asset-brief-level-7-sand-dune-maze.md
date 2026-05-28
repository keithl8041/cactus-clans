# Asset Brief — Level 7: Sand Dune Maze

## Gameplay TL;DR

Top-down maze on foot. Player navigates a procedurally generated 23×15 tile dungeon (48 px per tile = 1104×720 world). Pick up artifacts, dodge quicksand (slows you, drains the timer faster), avoid spike traps (instant fail), reach the exit portal. The camera follows the player; a compass appears above the player if they idle too long.

## Canvas + palette

- World canvas **1104 × 720** (tiles are 48×48 px). Logical viewport is **1280×720** with the world centred and outer band visible as bg.
- Background today is dark sand brown (`#4a3a26`); the floor/walls are tiled sand.

## Assets

### 7.1 Maze floor tile

Tileable sand pattern that fills every walkable cell.

- **Logical size:** **48 × 48 px**, **must tile seamlessly** in a grid.
- **Deliver:** PNG, opaque.
- **Variants:** 1 base — optionally 2–3 alternates with sparse detail (a footprint, a small stone, a wind-ripple) that the engine can scatter randomly. Most cells should use the plain variant or the maze looks too noisy.
- **Style:** sun-bleached sand, warm beige, subtle ripples. Low contrast so artifacts/traps pop on top.
- **Naming:** `dune-floor.png` (+ `dune-floor-detail-1.png`, etc., if delivering variants).

### 7.2 Maze wall tile

The blocks the player can't pass through.

- **Logical size:** **48 × 48 px**, tileable.
- **Deliver:** PNG, opaque.
- **Variants:** 1.
- **Style:** sandy dune ridge, slightly darker / warmer than the floor, with a visible top-edge highlight so adjacent walls read as a contiguous ridge, not floating bricks. Avoid hard outlines — this is sand, not stone.
- **Naming:** `dune-wall.png`.

### 7.3 Outer background (off-maze region)

Visible at the edges of the screen where the maze world doesn't reach.

- **Logical size:** **1280 × 720**, single image, opaque.
- **Deliver:** PNG.
- **Variants:** 1.
- **Style:** darker sand or dim distant dunes — visually subordinate to the maze, **frames** it. Could be the same `dune-floor.png` darkened/tiled as a fallback if budget is tight.
- **Naming:** `game7-background.png`.

### 7.4 Character (form 7 only, per clan)

Top-down view of the player. In this level the player is **always rendered as their clan's Form 7** — regardless of how far they've progressed — so we only need 10 sprites total, not the full 80.

- **Logical render size:** **36 px** (this is smaller than other levels because we're top-down).
- **Deliver:** PNG with alpha at **72×72** OR SVG.
- **Variants:** **10 sprites total — Form 7 for each of the 10 clans.** Form 7 names by clan:
  - Camo Clan — Fernwatcher
  - Duskerns — Obliviarch
  - Earth Clan — Earthfury
  - Hot Dog Clan — Flame Dawg
  - Metal Clan — Auroraforge
  - Oasis Clan — Aquasage
  - Prickling Clan — Sandstalker
  - Tropica Clan — Dragopalm
  - Tumbleweed Clan — Sandsweeper
  - Wildfire Clan — Emberwraith
- **Pose:** **top-down** — looking from above. Different from the front-facing character sprites used elsewhere. The character has 8-directional movement but **rotation is code-driven**, so deliver a **single "facing up" pose** and we'll rotate it.
  - Alternative if rotation looks weird: deliver 4 cardinal poses (up/right/down/left) per character. **Recommend single up-facing pose to start**, escalate to 4-way only if needed.
- **Naming:** `character-topdown-<clan-slug>-form7.png`.

### 7.5 Quicksand patch

A slow-zone the player can walk into but should avoid.

- **Logical render size:** **44 px** (placed on tiles, slightly smaller than the 48 px tile).
- **Deliver:** PNG with alpha at **88×88** OR SVG.
- **Variants:** 1.
- **Style:** swirling concentric sand rings, slightly darker / yellower than the floor tile, **clearly different** from regular sand. A subtle drifting / rippled texture reads as "soft, unstable". No animation needed — code can rotate the asset slowly if we want motion later.
- **Naming:** `dune-quicksand.png`.

### 7.6 Spike trap

Hidden trap that reveals itself when the player gets close (within 120 px) and kills on contact.

- **Logical render size:** **32 px**.
- **Deliver:** PNG with alpha at **64×64** OR SVG. **SVG preferred** — the trap fades in via an alpha tween, vector scales cleanly.
- **Variants:** **1 sprite**.
- **Style:** three to five upward-pointing spines / small cactus spikes arranged in a small cluster on the sand. Should read instantly as "ouch" — high-contrast dark tips, slight rust/brown shading. (This is **distinct** from the big `cactus-spike` used elsewhere — those are tall hazards, these are small ground traps.)
- **Naming:** `dune-trap.png` or `dune-trap.svg`.

### 7.7 Exit portal

The end goal of the maze.

- **Logical render size:** **48 px** (tile-aligned).
- **Deliver:** PNG with alpha at **96×96** OR SVG. SVG preferred — bobs slightly via code tween.
- **Variants:** 1, clan-agnostic.
- **Style:** ornate desert doorway / glowing pyramid arch / golden portal — something **unmistakably "the exit"**, more decorated than anything else in the maze. Warm gold + cool inner glow reads against the sandy tiles. **Family-friendly fantasy** — think children's adventure book, not Indiana Jones.
- **Naming:** `dune-exit.png`.

### 7.8 Artifact (collectible)

Sparkly bonus pickup scattered around the maze.

- **Logical render size:** **36 px**.
- **Deliver:** PNG with alpha at **72×72** OR SVG.
- **Variants:** **1 sprite** (optionally 2–3 if you want different "artifact" silhouettes — old coin, gemstone, scarab — designer's call).
- **Style:** small treasure — gold coin / gem / amulet. Slight inner glow. Bobs up and down via code; no animation needed in the art.
- **Naming:** `dune-artifact.png`.

### 7.9 Heart / health symbol (HUD)

The user requested a "health symbol". Today the maze is one-hit-fail with no visible lives, but this same icon is **used by Level 8** for the player's lives. Treating it as a **shared HUD asset**.

- **Logical render size:** **28 px**.
- **Deliver:** SVG (or PNG @2× = 56×56 with alpha).
- **Variants:** **1 sprite**, clan-agnostic. Optionally a **"lost life" / outline** variant for empty slots — designer's call (we can do this with alpha in code).
- **Style:** classic plump heart silhouette, warm red with a soft highlight. Should read at 28 px on a busy HUD.
- **Naming:** `heart.svg` (+ `heart-empty.svg` if delivering a paired empty variant).

> Where it shows up today: Level 8 lives indicator. We can adopt it in Level 7 if we add a multi-hit lives system later.

### 7.10 Breadcrumb / footprint (optional)

A faint trail behind the player. Fades over 6 s.

- **Logical render size:** **~24 px**.
- **Deliver:** SVG (single sprite, scaled / faded in code).
- **Variants:** 1.
- **Style:** tiny footprint, faint sand-coloured indent.
- **Naming:** `dune-breadcrumb.svg`. Optional — the procedural placeholder is fine.

### 7.11 Compass (optional)

Appears above the player when idle for 2.5 s, points to the exit.

- **Status:** today uses a 0.4× scale of the `dune-exit` sprite as a placeholder pointer. A dedicated **small compass icon** would be cleaner.
- **Logical render size:** **20 px**.
- **Deliver:** SVG.
- **Variants:** 1.
- **Style:** classic compass / arrow icon. The asset itself can be a simple gold arrow; the game rotates it toward the exit.
- **Naming:** `compass.svg`. Optional.

## State + animation notes

- All world sprites are tile-aligned (multiples of 48 px). Keep the silhouettes clean to that grid so the maze reads orthogonally.
- The character rotates via code — **don't bake in directional shadows** or asymmetric details that look broken when rotated.
- Artifacts bob with a sine tween; exit also bobs. Single static poses are correct.

## Delivery checklist

- [ ] 1 × floor tile PNG (48×48, tileable) + optional detail variants.
- [ ] 1 × wall tile PNG (48×48, tileable).
- [ ] 1 × outer background PNG (1280×720).
- [ ] Wave 1: 10 × top-down character PNGs (form 1 per clan).
- [ ] 1 × quicksand patch (88×88).
- [ ] 1 × spike trap (64×64).
- [ ] 1 × exit portal (96×96).
- [ ] 1 × artifact (72×72).
- [ ] 1 × heart icon (56×56) — **shared with Level 8**.
- [ ] Optional: breadcrumb, compass, character forms 2–8.
