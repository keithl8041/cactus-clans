# Asset Brief — Level 2: Floor Strip v2 (taller, lane-aware)

## Why

Playtest of the camel sprint showed that the original 60 px floor strip is too
shallow — three lanes can't fit on it cleanly, and the depth read is weak.
We're spacing the three lanes at **15 px / 60 px / 105 px** from the top of the
floor strip (where the camel's feet sit), so the floor needs to be tall enough
to contain them with some breathing room and ideally do some perspective work
on its own.

## Spec

- **Logical size**: `1280 × 150 px`, anchored to the bottom of the 1280×720
  canvas (sits at canvas y=570 → 720).
- **Format**: PNG with alpha if the top edge fades; otherwise opaque PNG is fine.
- **Tileable horizontally**: left and right edges must seam — the camel runs
  left-to-right and this strip scrolls past at full world speed.
- **Not tiled vertically**: vertical content is bespoke (top of strip ≠ bottom).
- **Naming**: `game2-floor.png` (replaces the existing 60-px file).

## Layout

Three implicit lane "bands" that the player and obstacles will sit on:

```
y=0   ─────────────── strip top (canvas y=570)
       │  back lane  │   feet land at y=15 inside the strip
y=30  ─┤             ├─
       │   mid lane  │   feet land at y=60
y=75  ─┤             ├─
       │ front lane  │   feet land at y=105
y=120 ─┤             ├─
       │   apron     │   30 px of pure ground below the front lane
y=150 ─────────────── strip bottom (canvas y=720)
```

Bands don't need hard borders — perspective shading is enough. The eye should
read it as "one road receding into the distance," not three stripes.

## Style

- Same desert palette as the parallax layers (dusk-leaning, warm sand) — see
  master brief section 1–2.
- Suggested perspective cues:
  - **Top band** (back): slightly cooler/lighter tone, finer-grained, less
    contrast — suggests distance.
  - **Bottom band** (front): warmer/darker, coarser, optionally a few small
    pebbles or ground detail — suggests proximity.
  - Subtle horizontal banding or very faint converging diagonals are fine if
    they read well at scroll speed; avoid hard lines.
- The top edge should blend into the parallax-near layer (foreground sand
  mounds) so there's no visible seam where the floor begins. A soft alpha
  fade-out across the top ~10 px is welcome.
- **No baked shadows.** The game draws shadows under the camel/obstacles.

## Reuse

- Level 8 (Desert Dash) shares this asset family. If the perspective work is
  level-2-specific (e.g. clear lane banding), make the L8 variant a separate
  file — we'll wire it independently.

## Delivery checklist

- [ ] `game2-floor.png` at 1280×150, horizontally tileable, top edge soft-fade.
- [ ] Quick sanity render: tile the asset 3× horizontally, confirm no seam.
