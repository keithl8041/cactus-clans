// Tuning constants for the lizard whack-a-mole level. Tweak freely.

export const LIZARD_WHACK_CONFIG = {
  // Win condition
  passThreshold: 35,                // target points to clear; ~17–18 fresh whacks
  roundDurationMs: 30_000,          // total round length
  missTolerance: 8,                 // un-whacked-lizard misses before early-fail

  // Grid
  gridCols: 3,
  gridRows: 3,
  gridHorizontalPadding: 0.08,      // fraction of viewport width left/right of grid
  gridVerticalPadding: 0.18,        // fraction of viewport height top/bottom of grid
  potSize: 110,
  lizardSize: 96,

  // Pop-up lifecycle (per-pot state machine)
  riseMs: 180,
  fallMs: 220,
  windowMs: 1100,                   // initial "up" window before auto-retract
  windowMinMs: 550,                 // window shrinks linearly to this by end of round
  cooldownMs: 350,
  freshFraction: 0.4,               // first 40% of windowMs = fresh whack tier

  // Scoring
  pointsFresh: 2,
  pointsLate: 1,
  pointsBandit: 5,
  banditBonusPoints: 3,             // added to bonusPoints (raw, not multiplied)

  // Spawn cadence (lerps across the round)
  spawnIntervalStartMs: 950,
  spawnIntervalEndMs: 480,
  spawnJitterMs: 220,
  doublesStartAtMs: 8_000,
  doublesProbability: 0.25,
  banditProbability: 0.12,
  banditWarmupMs: 5_000,

  // Visual / FX
  hitSplatDurationMs: 320,
  bonusFloatRiseY: 36,
  floatTextDurationMs: 700,
  backgroundColor: 0x2f1b3c,        // dusk purple — visually distinct from L1/L2

  // Input
  tapPadding: 8,                    // extra px around each pot's tap rectangle
} as const;

export function scaledConfig(completedRuns: number) {
  const t = Math.min(completedRuns, 10) / 10;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    ...LIZARD_WHACK_CONFIG,
    missTolerance: Math.max(2, lerp(8, 4)),
    windowMs: lerp(1100, 750),
    windowMinMs: lerp(550, 280),
    doublesStartAtMs: lerp(8_000, 4_000),
  };
}
