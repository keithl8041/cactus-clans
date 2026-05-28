# Asset Brief — Level 2: Camel Sprint

> Note on numbering: in chat we initially listed this as "level 6". The shipped order has **Camel Sprint = Level 2**, **Cactus Dart Toss = Level 6**. This file uses the shipped order.

## Gameplay TL;DR

Player rides a camel that stays fixed at the left of the screen while a 3-lane desert course scrolls past from right to left. Tap to switch lanes, hold to dash. Dodge rocks and cactus spikes, grab water flasks to refill a stamina bar, cross the finish banner.

> **Character form lock:** the rider in this level is always **Form 2** of the player's selected clan (regardless of their actual progression). Reuses the existing `character-<clan>-form2.png` from the master brief pipeline — no new character art required here.

## Canvas + palette

- Logical canvas **1280×720** (16:9), portrait letterboxing on phones.
- Style and palette follow the master brief (`_docs/asset-brief.md`, Sections 1–2). Use clan colour for the camel where indicated; everything else is clan-agnostic.

## Assets

### 2.1 Camel mount (per clan)

The biggest ask in this level — the camel is the player's vehicle and should match the clan's identity.

- **Logical render size:** 110 px tall (used at 22% canvas width, on the ground).
- **Deliver:** PNG with alpha at **220×220 px** (@2×). @3× welcome for the hero camels.
- **Pose:** side-view, **facing right** (running direction). Visible saddle/blanket area on the camel's back is where the player character will sit — the character is rendered as a separate sprite on top, so leave the saddle clear of detail and large enough to seat the existing 96 px character.
- **Variants:** **10 — one per clan.** Same silhouette, clan-specific blanket/saddle colour, plume, eye markings, etc. No runtime tinting.
- **Naming:** `camel-<clan-slug>.png` (e.g. `camel-wildfire-clan.png`). Slug rules per master brief.
- **Manifest key:** already wired — `camel.<clan-slug>` via `resolveCamelKey`.

> Phasing note: a single generic camel will cover all 10 clans on day one. Per-clan camels are wave 2.

### 2.2 Rock (obstacle)

A roadblock hazard the player must lane-change around.

- **Logical render size:** 80 px tall. Roughly square footprint.
- **Deliver:** **SVG preferred** (or PNG @2× = 160×160 with alpha).
- **Variants:** **1 sprite** (clan-agnostic). Optional: 2–3 silhouettes for visual variety if budget allows — same family, different outlines (squat, tall, cracked).
- **Style:** desert boulder, warm grey-brown, slight rim highlight so it reads against the tan floor. No baked shadow.
- **Naming:** `rock.svg` (or `rock-a.svg`, `rock-b.svg` for variants).
- **Reuse:** same asset reused by Level 8 (Desert Dash).

### 2.3 Cactus spike obstacle

Vertical hazard, same family as the Level 1 spike.

- **Status:** **already exists** — `/art/cactus-spike.png`. Reuse, no new delivery required.
- If the designer wants to refresh it, see Level 1 brief, Section 3.3.

### 2.4 Water flask (pickup)

Mid-lane collectible that refills the stamina bar.

- **Logical render size:** 48 px tall.
- **Deliver:** **SVG preferred** (or PNG @2× = 96×96 with alpha).
- **Variants:** **1 sprite**, clan-agnostic. Classic desert canteen / leather flask with a stopper. Slight gold/leather palette.
- **Style:** should pop against the tan floor — a small water-blue accent (cap, droplet) helps it read as "water".
- **Naming:** `water-flask.svg`.

### 2.5 Course background

The scrolling desert backdrop. Currently three procedural parallax layers.

- **Logical size:** each layer **1280 × 720**, designed to **tile horizontally** (left and right edges seam-free).
- **Deliver:** PNG, transparent where appropriate so layers stack:
  - **Far layer** — distant horizon, dunes, faint mountains, sky. Scrolls at 12% of camera speed. Opaque background (becomes the sky).
  - **Mid layer** — closer dunes, scattered cacti silhouettes. 35% scroll. Transparent above the dune line.
  - **Near layer** — foreground sand mounds, occasional tumbleweed shapes. 75% scroll. Transparent above its silhouette.
- **Variants:** 1 of each layer (3 PNGs total).
- **Naming:** `desert-parallax-far.png`, `desert-parallax-mid.png`, `desert-parallax-near.png`.
- **Style:** dusk-leaning palette per master brief (`#7a5a3a` floor zone, warm sky above). The mid/near layers carry the level's character — they should feel like *running across* a course, not *standing in* one.

### 2.6 Floor strip

The tan ground band the camel runs on.

- **Logical size:** 1280 × 60 px, tileable horizontally.
- **Deliver:** PNG (opaque).
- **Variants:** 1.
- **Naming:** `game2-floor.png`.

### 2.7 Finish banner

Marks the end of the course. Currently a procedural ribbon.

- **Logical render size:** 220 px wide.
- **Deliver:** PNG with alpha at **440×440** OR SVG.
- **Variants:** 1. Clan-agnostic.
- **Style:** trading-card banner / chequered-flag energy, family-friendly. Gold trim reads well.
- **Naming:** `finish-banner.png`.
- **Reuse:** same asset reused by Level 8.

## State + animation notes

- The camel sprite does **not** need walk-cycle frames — runtime bobs it via a sine offset, and lane changes are tweened. A single static side-on pose is correct.
- The stamina bar, HUD numbers, and lane outlines are all rendered in code — no art needed.
- All sprites should have **no baked-in shadow**; the game draws shadows under the camel/character.

## Delivery checklist

- [ ] 10 × camel PNGs (one per clan) at 220×220.
- [ ] 1 × rock SVG (or 2–3 variants).
- [ ] 1 × water-flask SVG.
- [ ] 3 × parallax layer PNGs (1280×720 each, tileable).
- [ ] 1 × floor strip PNG (1280×60, tileable).
- [ ] 1 × finish banner.

Reused from elsewhere: `cactus-spike.png` (Level 1).
