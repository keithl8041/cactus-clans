# Asset Brief — Level 5: Cactus Slicing

## Gameplay TL;DR

Fruit-ninja-style action. Whole cactuses (and the occasional tarantula) are lobbed from off-screen and arc across the canvas. Player swipes through them to slice — cactus = points, tarantula = strike (3 strikes and you're out). Slashes leave a brief yellow trail.

## Canvas + palette

- Logical canvas **1280×720**.
- Background today is desert night (`#2a1a0c`) — keep that high-contrast night feel so the bright yellow slash trail and golden floating "+5 pts" reads.

## Assets

### 5.1 Background

Replaces the flat dark-brown field.

- **Logical size:** **1280 × 720**, single image, opaque.
- **Deliver:** PNG.
- **Variants:** 1.
- **Style:** **desert night, low-key**. A starry sky, distant moonlit dunes, no busy detail in the central play area where projectiles fly. Cool indigo / deep brown palette — must not compete with the bright yellow slash trail or strike icons.
- **Naming:** `game5-background.png`.

### 5.2 Cactus (whole, sliceable)

The thing the player slices.

- **Logical render size:** **84 px** (with a small 60 px variant that spawns later in the run).
- **Deliver:** PNG with alpha at **168×168** OR SVG.
- **Variants:** **1 sprite, clan-agnostic**. Saguaro-style cactus with arms — the silhouette should make the "vertical seam" obvious so when it splits into halves it reads correctly.
- **Style:** classic green cactus, friendly, slightly rounded. Spines visible but not the focus.
- **Naming:** `cactus-whole.png`.

### 5.3 Cactus halves (left + right)

The two halves that fly apart after a slice. These need to **align with the whole cactus along its centre seam** so the cut looks clean.

- **Logical render size:** **~80 px each** (matches the whole cactus split vertically).
- **Deliver:** two PNGs with alpha at **160×160** each OR a single SVG sliced into two paths.
- **Variants:** 1 each (left half, right half).
- **Style:** the inside of the cut should show a wet/fleshy cactus interior (paler green/yellow, maybe a few seeds) — gives the slice a satisfying read.
- **Naming:** `cactus-half-left.png`, `cactus-half-right.png`.

> Designer note: the whole + two halves should look like the *same* cactus from the player's POV. Easiest workflow: design the whole first, then slice it down the middle for the halves.

### 5.4 Tarantula (hazard)

A "don't slice" projectile that costs the player a life if hit.

- **Logical render size:** **78 px**.
- **Deliver:** PNG with alpha at **156×156** OR SVG.
- **Variants:** **1 sprite**, clan-agnostic. Top-down or 3/4 view (since it rotates 90–300 deg/s while in flight, a non-directional silhouette reads best).
- **Style:** cartoon spider, NOT realistic — family-friendly. Big eyes, slightly comic. Dark brown / rust palette so it reads as "danger" against the yellow slash. **Crucially**: the silhouette must be **immediately distinguishable from a cactus**, even peripheral vision, even at 0.71× scale. Round body + legs reads great against the cactus's vertical bar shape.
- **Naming:** `tarantula.png`.
- **Reuse:** the **same** tarantula sprite is reused (at larger scale) for the Level 8 boss — see that brief.

### 5.5 Strike icons (optional)

Three tarantula icons at the top of the screen — the player's "lives". Currently drawn from the same `tarantula` sprite at 28 px.

- **Status:** **reuses the asset from 5.4** at a small size. No new delivery required unless the designer wants a dedicated tiny strike icon (silhouette / outlined version) — defer-able polish.

## State + animation notes

- All projectiles rotate **continuously** while in flight (code-driven). A **single static pose** is correct for each — no spin frames, no walk cycles.
- The slash trail is drawn entirely in code (yellow stroked polyline) — no art needed.
- All sprites: transparent alpha, no baked shadow.

## Delivery checklist

- [ ] 1 × background PNG (1280×720).
- [ ] 1 × whole cactus PNG (168×168).
- [ ] 2 × cactus half PNGs (160×160 each, left + right, aligned).
- [ ] 1 × tarantula PNG (156×156).

Reused into Level 8: the tarantula sprite (see Level 8 brief, Section 8.4).
