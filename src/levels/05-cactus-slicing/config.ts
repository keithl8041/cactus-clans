// Tuning constants for the cactus slicing level. Tweak freely.

export const CACTUS_SLICING_CONFIG = {
  // Win condition
  passThreshold: 85,                // points to clear (raised — was too easy at 55)
  strikeLimit: 2,                   // tarantula slices allowed before instant fail
  missTolerance: 6,                 // cacti that fall off-screen unsliced before fail (was 10)
  sessionDurationMs: 45_000,        // round length

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

  // Projectile sizes / hitboxes (slightly bigger sprites per design feedback;
  // hitboxes scaled in proportion so slicing accuracy stays consistent)
  cactusRadiusPx: 42,
  cactusDisplaySize: 96,
  cactusHalfSize: 92,
  tarantulaRadiusPx: 41,
  tarantulaDisplaySize: 90,

  // Small cactus variant (ramp)
  cactusSmallRadiusPx: 30,
  cactusSmallDisplaySize: 70,

  // Spawning cadence (quicker + busier than the original easy tuning)
  spawnIntervalStartMs: 1000,
  spawnIntervalMinMs: 280,
  spawnRampPerSecond: 16,           // ms shaved off the interval per elapsed sec
  burstChanceStart: 0,
  burstChanceMax: 0.58,
  burstRampSeconds: 26,
  burstMaxSize: 4,
  burstStaggerMs: 100,
  smallCactusUnlockSec: 12,
  smallCactusChance: 0.45,
  tarantulaChanceStart: 0.18,
  tarantulaChanceMax: 0.55,
  tarantulaRampSeconds: 24,

  // Slash trail (ring buffer)
  trailSampleLifetimeMs: 140,
  trailMaxSamples: 24,
  trailMinSampleSpacingPx: 6,
  trailMinSliceLengthPx: 28,        // gates short taps from being slices
  trailLineWidth: 6,
  trailColor: 0xfff5b7,

  // Slice detection
  sliceComboWindowMs: 220,          // gap to still count as same swipe combo
  comboTierBonusStep: 5,            // +5 per additional slice
  comboMaxTier: 5,
  slicePointsBase: 5,
  maxSwipeDurationMs: 10_000,       // force-end a swipe held longer than this

  // Clean cut (skill bonus)
  cleanCutFraction: 0.3,            // trail must pass within radius*frac of center
  cleanCutBonus: 2,                 // bonus points for a clean cut

  // Half-cactus flight (post-slice)
  halfSpinPerSec: 360,
  halfFadeOutMs: 700,
  halfGravityScale: 1.0,
  halfKickPx: 80,                   // outward velocity kick per half

  // Slice juice
  comboSlowMoTier: 3,               // combo count at which slow-mo kicks in
  slowMoTimeScale: 0.55,
  slowMoDurationMs: 180,
  sparkDurationMs: 260,
  sparkRadius: 24,
  sparkRadiusClean: 36,

  // Strike feel
  strikeShakeMs: 220,
  strikeShakeIntensity: 0.014,
  strikeFlashDurationMs: 300,
  strikeFlashColor: 0xd24a3a,

  // HUD
  strikeIconSize: 28,
  missPipSize: 14,
  hudPaddingPx: 16,

  // Background
  backgroundColor: 0x2a1a0c,        // desert-night

  // Input
} as const;
