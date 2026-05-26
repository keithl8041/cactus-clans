// Tuning constants for the cactus slicing level. Tweak freely.

export const CACTUS_SLICING_CONFIG = {
  // Win condition
  passThreshold: 45,                // points to clear (~9 plain slices, or fewer with combos)
  strikeLimit: 3,                   // tarantula slices allowed before instant fail
  sessionDurationMs: 60_000,        // round length

  // World
  gravityY: 900,                    // matches L2 — believable arcs on phone screens

  // Projectile physics
  spawnYFractionMin: 0.78,
  spawnYFractionMax: 0.95,
  launchVxMin: 220,
  launchVxMax: 360,
  launchVyMin: -1150,
  launchVyMax: -900,
  spinPerSecMin: 90,
  spinPerSecMax: 300,

  // Projectile sizes / hitboxes
  cactusRadiusPx: 38,
  cactusDisplaySize: 84,
  cactusHalfSize: 80,
  tarantulaRadiusPx: 36,
  tarantulaDisplaySize: 78,

  // Small cactus variant (ramp)
  cactusSmallRadiusPx: 26,
  cactusSmallDisplaySize: 60,

  // Spawning cadence
  spawnIntervalStartMs: 1500,
  spawnIntervalMinMs: 500,
  spawnRampPerSecond: 12,           // ms shaved off the interval per elapsed sec
  burstChanceStart: 0,
  burstChanceMax: 0.35,
  burstRampSeconds: 35,
  burstMaxSize: 3,
  burstStaggerMs: 110,
  smallCactusUnlockSec: 25,
  smallCactusChance: 0.25,
  tarantulaChanceStart: 0.10,
  tarantulaChanceMax: 0.35,
  tarantulaRampSeconds: 40,

  // Slash trail (ring buffer)
  trailSampleLifetimeMs: 140,
  trailMaxSamples: 24,
  trailMinSampleSpacingPx: 6,
  trailMinSliceLengthPx: 28,        // gates short taps from being slices
  trailLineWidth: 6,
  trailColor: 0xfff5b7,

  // Slice detection
  sliceComboWindowMs: 350,          // gap to still count as same swipe combo
  comboTierBonusStep: 3,            // +3 per additional slice
  comboMaxTier: 4,
  slicePointsBase: 5,

  // Half-cactus flight (post-slice)
  halfSpinPerSec: 360,
  halfFadeOutMs: 700,
  halfGravityScale: 1.0,
  halfKickPx: 80,                   // outward velocity kick per half

  // HUD
  strikeIconSize: 28,
  hudPaddingPx: 16,

  // Background
  backgroundColor: 0x2a1a0c,        // desert-night
} as const;
