// Tuning constants for the camel-sprint level. Tweak freely.

export const CAMEL_RACE_CONFIG = {
  // Win condition
  passThreshold: 153,                  // ~85% of courseDistancePx / 100
  courseDistancePx: 18_000,            // total race length in world px
  courseTimeLimitMs: 90_000,           // race auto-ends at this time
  passDistanceFraction: 0.85,          // fraction of course needed to pass on timeout

  // Lanes — stacked across the 150px floor strip (canvas y 570–720). All entities
  // are bottom-anchored to the lane's ground line. Depth cue comes from y-position
  // alone; the camel stays the same size across lanes. Front-lane occlusion is
  // handled by render depth, not scale.
  laneCount: 3,
  laneYFractions: [0.8125, 0.875, 0.9375],  // back → front: feet at floor-top+15, +60, +105 (y = 585, 630, 675)
  laneScales: [1.00, 1.00, 1.00],           // no per-lane diminishing — kept for future tuning
  laneChangeMs: 180,                        // tween time for lane swap

  // Speed
  baseSpeed: 380,                      // px/sec at start
  baseSpeedFinal: 540,                 // px/sec at the finish line
  baseSpeedLow: 280,                   // px/sec when stamina depleted
  dashMult: 1.6,                       // multiplier while dashing
  dashBurstMs: 240,                    // duration of a "tap dash"

  // Stamina
  staminaMax: 100,
  staminaStart: 70,
  staminaRegenPerSec: 4,               // passive trickle (always on)
  staminaDashDrainPerSec: 22,          // burn rate while sustained dash
  staminaTapFloor: 5,                  // min stamina cost per tap dash
  staminaHitPenalty: 25,               // drained on obstacle collision
  staminaPickupGain: 25,               // restored by a water flask
  staminaRecoveryThreshold: 20,        // dash re-enabled above this after empty

  // Hit penalty
  hitSpeedPenaltyMs: 800,
  hitSpeedMult: 0.55,
  hitIframesMs: 600,
  livesStart: 3,                       // race ends in failure when these are gone

  // Obstacles
  obstacleBaseGapPx: 720,
  obstacleEndGapPx: 360,
  obstacleLanesAtOnceStart: 1,
  obstacleLanesAtOnceEnd: 2,
  obstacleRockChance: 0.55,            // chance of rock vs cactus
  obstacleSize: 80,

  // Pickups
  pickupSpawnEveryPx: 900,
  pickupSpawnJitter: 0.30,             // ±30% on spawn spacing
  pickupSize: 48,
  pickupBonusPoints: 5,                // added to bonusPoints per flask

  // Input
  tapMoveThresholdPx: 14,              // pointer travel above which a press is a hold (not a tap)
  tapMaxMs: 220,
  holdZoneInsetPx: 80,                 // top inset so HUD presses aren't read as lane-shift triggers

  // Parallax scroll multipliers
  parallaxFarMult: 0.12,
  parallaxMidMult: 0.35,
  parallaxNearMult: 0.75,

  // Track / camel
  camelSize: 110,
  camelXFraction: 0.22,                // camel sits at this x always (world scrolls past it)
  camelBobAmplitudePx: 3,              // peak vertical offset of the running-gait bob
  camelBobHz: 3.2,                     // cycles per second of the bob
  parallaxFinishBannerAtPx: 17_500,    // banner becomes visible from this world-x
  finishBannerSize: 220,

  // Background
  backgroundColor: 0x3a4a78,           // dusk-sky blue, lighter than L1's nighttime green
  groundColor: 0xb37a4a,               // warm sand
} as const;
