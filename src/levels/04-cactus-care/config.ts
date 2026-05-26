// Tuning constants for the cactus care level. Tweak freely.

export const CACTUS_CARE_CONFIG = {
  // Win condition
  passThreshold: 24,                // seconds in green; ~60% of 40s window
  surviveMs: 40_000,                // total run length

  // Meter
  meterMin: 0,
  meterMax: 100,
  meterStart: 60,                   // mid-green
  happyBandLow: 40,                 // green band lower edge (easy phase)
  happyBandHigh: 75,                // green band upper edge (easy phase)
  centerBandHalfWidth: 6,           // "perfect" sub-band half-width around band midpoint

  // Rates (meter units per second)
  baseDecayPerSec: 8,               // passive thirst
  waterRatePerSec: 22,              // net +14/sec while watering, no events
  sunBlastDecayPerSec: 18,          // added to base decay during sun event
  rainRisePerSec: 26,               // added during rain event

  // Event timings
  sunBlastDurationMs: 3_500,
  rainDurationMs: 3_000,
  eventMinDelayMs: 5_000,
  eventMaxDelayMs: 9_000,
  firstEventDelayMs: 6_000,

  // Wilt/drown grace
  wiltGraceMs: 2_000,

  // Bonus
  bonusPerCenterSec: 1,             // bonusPoints per full second spent in center sub-band

  // Sprites / layout
  canSize: 72,
  cactusSize: 160,
  meterBarWidth: 28,
  meterBarHeight: 320,
  meterFollowSmoothing: 0.18,       // visual lerp factor for the displayed fill
  canFollowSmoothing: 0.35,         // can lerps toward pointer

  // Watering geometry
  cactusHitRadius: 80,              // distance from spout to cactus center counted as watering
  canSpoutOffsetX: 28,              // where the spout tip sits relative to the can sprite origin
  canSpoutOffsetY: 4,

  // Difficulty ramp phases (fraction of surviveMs)
  difficultyMidStartPct: 0.33,
  difficultyLateStartPct: 0.66,
  decayMultMid: 1.25,
  decayMultLate: 1.55,
  bandShrinkMid: 4,                 // total band shrinkage (split between top + bottom)
  bandShrinkLate: 8,
  eventDelayMultMid: 0.8,
  eventDelayMultLate: 0.62,

  // Background
  backgroundColor: 0xe5b97f,        // warm tan — distinct from L1 sky and L2 dusk
} as const;
