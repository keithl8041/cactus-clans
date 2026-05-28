// Tuning constants for the level-2 cactus dart toss. Tweak freely.

export const CACTUS_DARTS_CONFIG = {
  // Win condition
  passThreshold: 90, // ~6 bullseyes, or 9 middles, or all 15 outer-rings plus a few middles
  quiverSize: 15,    // total cacti the player gets per attempt

  // World
  gravityY: 900,
  floorPadding: 12,
  playerSize: 96,
  spikeSize: 56,
  boardSize: 140,

  // Swipe-to-throw: drag anywhere on screen in the direction you want to throw.
  // Power scales with swipe length. No anchor to the character, so the gesture
  // can start anywhere — handy on small screens where the player is hard up
  // against the left edge.
  maxDragPx: 220,         // swipe length past this is clamped to max power
  dragPowerScale: 5.5,    // velocity = swipe * scale (clamped). 220 * 5.5 = 1210 → clamped to 1200
  maxThrowVelocity: 1200, // px/sec — keep arc believable on small screens
  minDragPx: 24,          // shorter swipes on release = no throw, free re-aim

  // Projectile
  spikeSpinPerSec: 540,   // degrees/sec rotation in flight
  stickInMs: 350,         // time the spike "sticks" before the next throw arms

  // Trajectory preview. Length scales with cacti remaining (previewDotsMin +
  // quiverRemaining), so the aim gets noticeably shorter as the quiver
  // empties — never less than previewDotsMin dots.
  previewDotsMin: 5,
  previewDotIntervalMs: 60,
  previewDotRadius: 3,
  previewDotColor: 0xfff5b7,

  // Dartboard — distance ramp (as fraction of viewport width, board center x)
  boardDistances: [0.62, 0.70, 0.78, 0.85, 0.92] as ReadonlyArray<number>,
  boardYFraction: 0.42,           // initial y (fraction of viewport height)
  boardShrinkPerHit: 0.95,        // multiply boardSize by this each successful hit
  boardMinScale: 0.65,            // don't shrink below this

  // Ring layout (radii as fraction of the rendered board radius)
  ringRadii: {
    bullseye: 0.18,
    middle: 0.45,
    outer: 0.95,
  },
  ringPoints: {
    bullseye: 15,
    middle: 10,
    outer: 5,
  },

  // Moving dartboard (drift along y). Wide, lazy sweeps — fast tight wobbles
  // are unfair on small screens.
  boardDriftStartHit: 2,
  boardDriftAmplitudePx: 170,
  boardDriftPeriodMs: 3400,
  boardDriftPeriodMultPerHit: 0.93, // each extra hit shortens the period slightly

  // Advance tween (how the board moves to the next distance)
  advanceTweenMs: 380,
} as const;
