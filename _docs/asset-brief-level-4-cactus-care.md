# Asset Brief — Level 4: Cactus Care

## Gameplay TL;DR

Player has a single pet cactus in a pot. A watering can follows the pointer; tapping releases water that fills a vertical thirst meter. Keep the meter inside a green "happy band" — too dry or too wet and the score stops climbing. Sun and rain weather events change the rate, and the happy band shrinks over time.

## Canvas + palette

- Logical canvas **1280×720**.
- Background today is a warm tan (`#e5b97f`) — keep that sun-baked daylight feel by default.
- Style and palette follow the master brief.

## Assets

### 4.1 Pet cactus (per clan)

The hero of this level. Sits in the centre-lower part of the canvas.

- **Logical render size:** **160 px** tall.
- **Deliver:** PNG with alpha at **320×320** (@2×).
- **Pose:** front-facing, friendly, expressive face (eyes, a mouth) — this is a *pet*, not a hazard. Should look like the same cactus species as the spike from Level 1 (Saguaro-style silhouette) but cute and rounder. Sat *inside* a pot (the pot is part of the asset OR separate — see note).
- **Pot:** simple terracotta pot under the cactus is fine. Designer's choice whether to bake the pot into the cactus PNG or deliver as a separate asset — happy either way. **Recommend: separate**, so the pot can be reused with Level 3.
- **Variants:** **10 — one per clan**, clan-coloured fronds/blooms/spines. Same silhouette.
- **Naming:** `cactus-pet-<clan-slug>.png`.

> Phasing note: a single generic cactus is fine for day one; per-clan cactuses are wave 2.

### 4.2 Watering can

Follows the pointer, tips forward when pouring.

- **Logical render size:** **72 px** tall.
- **Deliver:** PNG with alpha at **144×144** OR SVG. Two poses if we want a "tipping" frame:
  - **Idle** — spout pointing slightly down-right.
  - **Pouring** — same can rotated forward ~30° (we can do this with code rotation — single pose is sufficient).
- **Variants:** **1**, clan-agnostic. Metal/galvanised can with a wooden handle reads well against the warm background. A small clan-coloured accent stripe is welcome but not required.
- **Naming:** `watering-can.png`.

### 4.3 Background (sunny / default)

Replaces the flat tan field.

- **Logical size:** **1280 × 720**, full canvas, single image.
- **Deliver:** PNG, opaque.
- **Variants:** 1 (default sunny state).
- **Style:** bright daylight desert. A windowsill / patio feel works (this is the cactus's "home"), or a sunlit garden. Keep the centre uncluttered — the cactus sits in the middle-lower area, the meter occupies the right edge, watering can hovers above. A faint horizon and warm sky carry the mood.
- **Naming:** `game4-background.png`.

### 4.4 Background (overwatered / rainy)

Shown when the rain event is active. Currently a procedural blue alpha overlay. The user is right that a proper rainy backdrop would feel much better.

- **Logical size:** **1280 × 720**, full canvas, single image.
- **Deliver:** PNG, opaque.
- **Variants:** 1 (rainy / overcast state). Same scene composition as 4.3 — windowsill / patio — but with grey skies, puddles, raindrop streaks. The transition is a 350 ms alpha tween between the two backgrounds.
- **Naming:** `game4-background-rain.png`.

> Optional polish: a third "sun blaze" variant for the harsh-sun event would be lovely — bleached highlights, white hot sky. Same dimensions, naming `game4-background-sun.png`. Defer-able.

### 4.5 Thirst meter / gauge

The vertical fill bar on the right edge showing soil moisture, with a target "happy band" overlay.

- **Logical size:** **28 px wide × 320 px tall**.
- **Deliver:** **SVG preferred** — the gauge frame and the happy-band markers. The fill itself is drawn in code (changes colour from red → gold → blue based on level), so the asset is the **empty frame + tick marks + label area** only.
- **Variants:** **1** — clan-agnostic. Wooden-stake / garden-thermometer styling with a clear empty channel down the middle. A small water-drop icon at the top and a sun icon at the bottom labels the extremes nicely.
- **Naming:** `thirst-gauge.svg`.

> If the designer would prefer to deliver this as a full per-state PNG (dry, happy, drenched) we can adapt — but the code-driven fill stays more flexible.

### 4.6 Water droplet (optional)

Tiny droplets stream from the watering can spout when pouring.

- **Logical render size:** ~8 px (drawn as 3.5 px radius graphics today).
- **Deliver:** SVG, single droplet.
- **Variants:** 1.
- **Style:** classic teardrop, soft blue.
- **Naming:** `water-droplet.svg`. Optional — code-drawn placeholder is fine for v1.

## State + animation notes

- The cactus does **not** need wilting / drenched variants for v1 — its state is communicated by the meter colour and HUD. *Stretch goal*: a "wilted" and a "drenched" expression variant would be a delightful polish pass (same silhouette, sad eyes / closed eyes, droopy or hyper-perky pose). Defer unless budget allows.
- The watering can tilts via code rotation — a single idle pose is fine.
- The rain overlay can stay code-drawn (existing `rainOverlay` placeholder) once we have the rainy background; deliver only the background for now.

## Delivery checklist

- [ ] 10 × pet cactus PNGs (one per clan, 320×320).
- [ ] 1 × watering can PNG (144×144) or SVG.
- [ ] 1 × sunny background PNG (1280×720).
- [ ] 1 × rainy background PNG (1280×720).
- [ ] 1 × thirst gauge SVG (28×320 frame).
- [ ] Optional: 1 × water droplet SVG, harsh-sun background variant.
