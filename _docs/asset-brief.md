# Cactus Clans — Asset Brief

A list of every visual asset the online companion app currently uses, with the exact dimensions, variant counts, and delivery notes for the UI designer. The codebase currently ships with procedural SVG placeholders for every entry — the goal is to swap each placeholder for real art one at a time without changing any code outside `src/assets/manifest.ts`.

---

## 1. Project context (TL;DR for the designer)

- **Genre:** mobile-first mini-game companion to a physical trading card game. Family-friendly, kid-readable, slight cartoon edge.
- **Setting:** a stylised desert with cacti, dust, heat, and a bit of attitude. Dark backdrop, warm accents.
- **Canvas:** every Phaser mini-game runs on a fixed logical canvas of **1280×720** (16:9), letterboxed to fit the device. Plan asset sizing against that logical resolution, not the screen pixel count.
- **Delivery format (preferred):**
  - **SVG** for geometric / iconic items (spikes, stars, card frames). Vector, scales everywhere.
  - **PNG with transparent alpha** for illustrated character art. Deliver at **@2x** the logical pixel size below (so a 96 px logical sprite ships as a 192 px PNG). @3x is welcome for the hero character art if budget allows.
- **Background:** every sprite should be transparent unless explicitly marked otherwise. No baked-in shadows under sprites — the game layers its own shadow ellipses for the character.
- **Colour palette (current):** dark green `#16291c` field, warm sand `#7a5a3a` floor, golden accent `#f7c948`, deep brown shadows. Per-clan colours below.
- **Tinting:** currently the placeholder uses the clan colour as input. For real art it's easier (and prettier) to **deliver one variant per clan** — no runtime tinting. Where you'd otherwise hit 80+ sprites for character art, see Section 6 for ways to scope this down.

---

## 2. Clan palette + tagline reference

Ten clans, each themed around a desert/biome flavour. Designer should treat these as the source-of-truth palette per clan:

| Clan | Theme colour | Tagline |
|---|---|---|
| Camo Clan | `#4a6b3a` (mossy green) | Masters of disguise. |
| Duskerns | `#5d3a8c` (twilight violet) | Born of shadow and silence. |
| Earth Clan | `#7a5a3a` (warm umber) | Unshakable. Unbreakable. |
| Hot Dog Clan | `#c44a3a` (ketchup red) | Loyal, loud, and lethal. |
| Metal Clan | `#8a8f99` (cool steel) | Forged in fire and discipline. |
| Oasis Clan | `#3a8caa` (oasis teal) | Where water flows, life grows. |
| Prickling Clan | `#5a8a3a` (cactus green) | Sharp from sprout to sovereign. |
| Tropica Clan | `#3aaa6a` (tropic green) | Wild, warm, and watchful. |
| Tumbleweed Clan | `#b89a5a` (dust gold) | Drifts with purpose. |
| Wildfire Clan | `#e86a2a` (ember orange) | Burns brightest in danger. |

Designer is free to derive complementary tones (highlight, shadow, accent) from each base colour.

---

## 3. Critical assets (Level 1 — Balloon Keepy-Uppy)

These are needed before we can ship a real-looking Level 1. Everything else is upgrade-as-you-go.

### 3.1 Character sprite (player avatar)

The single biggest art ask. Used both in-game and on the level-map screen.

- **Logical render size:** 96 px square (in-game), 140 px square (on the level-map screen).
- **Deliver:** PNG with alpha at **280×280 px** (~2× the largest use).
- **Transparency:** full alpha; no baked-in shadow (the game draws its own).
- **Pose:** front-facing, neutral idle, slight readable silhouette. Eyes visible.
- **Variants:** **10 clans × 8 evolution forms = 80 sprites total.**
  - Form 1 is the youngest "sprout" — small, cute, simple.
  - Form 8 is the clan boss — biggest, most ornate.
  - Forms 2–7 are visible progression between those two extremes (size, accessories, expression).
- **Naming convention:** `character-<clan-slug>-form<N>.png` (e.g. `character-wildfire-clan-form3.png`). Slug: lowercase, hyphenated.
- **Names of each form per clan:** see Section 7 below — these come from the physical cards.

> Scope note: 80 sprites is a lot. If we need to phase this, prioritise **form 1 and form 8 for every clan first (20 sprites)** — those are what players see on the clan-select screen and at the end of a run. Forms 2–7 can land in waves.

### 3.2 Balloon

The toy the player bounces on their head in Level 1.

- **Logical render size:** 96 px (width). Height ≈ 120 px (a slim string tail is part of the asset).
- **Deliver:** **SVG** (or PNG @2× = 192×240 with alpha).
- **Variants:** **one per clan colour (10 total)**. The balloon colour should match the player's current clan.
- **Style:** classic party balloon, knot + short string. Slight glossy highlight reads well at small size.
- **Naming:** `balloon-<clan-slug>.svg` or `.png`.

### 3.3 Cactus spike (hazard)

A pointy cactus segment used as a balloon-popping hazard.

- **Logical render size:** ~56 wide × 80 tall (vertical/upward-pointing orientation).
- **Deliver:** **SVG preferred** (single upward-pointing asset; the game rotates it 0/90/180/270° at runtime for floor/wall/ceiling spikes).
- **Variants:** **1 sprite total**, clan-agnostic. Default desert cactus green.
- **Style:** spiky enough to read at small size, classic Saguaro silhouette. The placeholder is a triangle — happy with anything that reads as "cactus spike" from across the room.
- **Naming:** `cactus-spike.svg`.

### 3.4 Bonus star (pickup)

Optional pickup that drifts in during play and awards bonus points.

- **Logical render size:** 56 px square.
- **Deliver:** SVG (or PNG @2× = 112×112 with alpha).
- **Variants:** **1 sprite total**, clan-agnostic. Golden / glowing.
- **Style:** classic 5-point bonus star with warm gold gradient and a subtle outline. Should pop against the dark background.
- **Naming:** `star.svg`.

---

## 4. Card-grid screen assets

Shown on the **clan-select** screen as a grid of tappable tiles, one per clan. Today the placeholder draws a coloured panel with the clan name + form name in text.

### 4.1 Card tile

- **Logical render size:** 200 × 280 px (5:7, standard trading-card aspect).
- **Deliver:** PNG with alpha at **400 × 560 px** (@2×).
- **Variants:** initial scope is **1 per clan = 10 tiles**, each showing the clan's Form 1.
  - Stretch goal: 1 per clan × form (80 tiles) so the level-map can show the current form's card as the player advances. We don't need that for v1 — fine to defer.
- **Composition:** Each tile should include the **clan name** at the top, the **character art** (Form 1 for v1), and the **form name** at the bottom. Designer is welcome to roll their own typography — the placeholder uses a generic sans-serif.
- **Naming:** `card-<clan-slug>-form1.png`.

---

## 5. Background / environment assets (nice-to-have, defer-able)

These are currently rendered as flat coloured rectangles. Replacing them is a polish pass, not a blocker.

| Asset | Purpose | Logical size | Variants | Notes |
|---|---|---|---|---|
| Sky / sandy backdrop | Level 1 (and future levels) | 1280 × 720 | 1 or 1 per level | Subtle parallax-friendly horizon would be lovely but not required. |
| Floor strip (sandy ground) | bottom of the play arena | 1280 × ~60 px | 1 | Currently a solid `#7a5a3a` rect. |
| Splash / title illustration | Splash screen | flexible, ~1024 × 600 | 1 | Could supersede the existing `public/logo.jpg`. |
| Level-map background | journey map screen | flexible | 1 | A stylised desert path with 8 nodes would be ideal, but we can fake it with the current node track for a while. |

---

## 6. Phasing recommendation (if budget is a constraint)

To get the biggest visual lift fastest:

1. **Wave 1 (highest impact):** 10 × Form 1 characters + 10 × Form 8 characters + balloon (10) + cactus spike (1) + star (1) + card tiles for Form 1 (10) = **42 assets**. This makes the splash → clan-select → first level look completely real.
2. **Wave 2:** the remaining 60 character forms (forms 2–7 per clan).
3. **Wave 3:** background / environment polish (Section 5).

---

## 7. Reference: form names per clan

Pulled from the physical card spreadsheet. Form numbers 1 → 8 follow the array order below.

### Camo Clan
1. Chamelion · 2. Leaflink · 3. Mossshift · 4. Barkhide · 5. Stoneveil · 6. Shadowstrike · 7. Fernwatcher · 8. Chameleon King

### Duskerns
1. Spiren · 2. Shadowspike · 3. Nightbloom · 4. Voidlord · 5. Dusk Emperor · 6. Twilightseed · 7. Obliviarch · 8. Eclipse Wraith

### Earth Clan
1. Stonebud · 2. Rockroot · 3. Terrashaper · 4. Stonewarden · 5. Gaius Sovereign · 6. Mountainborn · 7. Earthfury · 8. Terramancer

### Hot Dog Clan
1. Diggodgy Dog · 2. Ketchup Kid · 3. Wiener Warrior · 4. Saucy Soldier · 5. Chili Chef · 6. Mustard Mauler · 7. Flame Dawg · 8. The Big Bun Boss

### Metal Clan
1. Ironbud · 2. Steelspike · 3. Chromesentry · 4. Goldenbloom · 5. Platinum Sage · 6. Iridium Champion · 7. Auroraforge · 8. Ancient Pricklord

### Oasis Clan
1. Sprouting · 2. Palmfrond · 3. Dunesage · 4. Mirageguard · 5. Oasis Sovereign · 6. Tidestrider · 7. Aquasage · 8. Dunesoverlord

### Prickling Clan
1. Prickling · 2. Spiket · 3. Bloomguard · 4. Thorncrown · 5. Desert Titan · 6. Sunspire · 7. Sandstalker · 8. Prickshot

### Tropica Clan
1. Coconi · 2. Pinebud · 3. Mangolo · 4. Papayo · 5. Banoni · 6. Kiwini · 7. Dragopalm · 8. Watermelord

### Tumbleweed Clan
1. Dustling · 2. Whirler · 3. Galebinder · 4. Duststorm · 5. Sandlord · 6. Dunehunter · 7. Sandsweeper · 8. Windseer

### Wildfire Clan
1. Spark · 2. Flareling · 3. Infernoblade · 4. Conflagrator · 5. Wildfire Lord · 6. Ashstalker · 7. Emberwraith · 8. Pyroclast

---

## 8. Delivery checklist

For each asset, please include:

- [ ] Source file (SVG, or layered PSD/AI for PNG output).
- [ ] Exported file in the requested format + size.
- [ ] Transparent background (unless explicitly noted otherwise).
- [ ] Consistent naming (see naming notes per section).
- [ ] If illustrated character art: optional second @3× export for hero shots (splash, win screens).

Drop everything into a shared folder; we'll lift sprites into `public/art/` in the codebase one at a time and flip the matching line in `src/assets/manifest.ts` from `{ kind: 'svg', ... }` to `{ kind: 'png', src: '/art/<name>.png' }` (or SVG path). No designer involvement needed for the swap itself.
