// Tuning constants for the balloon keepy-uppy level. Tweak freely.

export const BALLOON_CONFIG = {
  // Win condition
  passThreshold: 10,
  timeLimitMs: 60_000,

  // World
  baseGravity: 700,             // pixels/sec^2 — applies to player; balloon uses its own gravity
  balloonGravityY: 240,         // balloon's own gravity (slower than player)
  balloonSize: 96,
  cactusSize: 80,
  floorPadding: 60,             // height of sandy floor strip (matches Game1Floor.png height)
  groundLineOffset: 30,         // floor cactus base sits this far below the top of the strip
  playerSink: 8,                // player feet sit this many extra px below the cactus ground line
  maxFallSpeed: 600,            // balloon terminal velocity

  // Player
  playerSize: 96,
  playerMaxSpeed: 360,
  playerMaxFallSpeed: 800,
  playerJumpImpulse: -520,
  playerGroundDrag: 1200,       // horizontal drag when no input (px/sec^2)

  // Input — touch jump button
  jumpButtonRadius: 56,         // visible radius (px); hit area is slightly larger
  jumpButtonMargin: 18,         // distance from the bottom-right corner (above the floor strip)
  // Input — swipe-up to jump (mobile-friendly alternative to the button)
  swipeUpJumpPx: 60,            // vertical drag distance that counts as a jump swipe

  // Balloon bounce off player
  balloonMaxBounceVX: 280,
  balloonBounceVY: -360,
  jumpBounceBoostThreshold: 60, // |vy| above this means player is mid-jump
  jumpBounceBonusVY: -180,
  hitCooldownMs: 250,

  // Difficulty: spikes
  firstWallSpikeAt: 5,
  spikeRampEvery: 3,
  wallPadding: 16,

  // Difficulty: wind
  windRampHits: 18,             // intensity reaches 1.0 at this hit count
  windMinDelayMs: 1200,
  windMaxDelayMs: 3000,
  windGustMs: 900,
  windMinAccel: 120,
  windMaxAccel: 320,

  // Reward stars
  starSize: 56,
  starBonusPoints: 3,           // added to bonusPoints (raw, not multiplied)
  starFirstDelayMs: 4000,       // wait this long after the level starts before the first star
  starMinDelayMs: 6000,         // random gap between stars: lower bound
  starMaxDelayMs: 14000,        // upper bound — "not too often"
  starLifetimeMs: 11000,        // star disappears on its own after this long
  starTopOffset: 36,            // distance from top of canvas where star sits
} as const;

export function scaledConfig(completedRuns: number) {
  const t = Math.min(completedRuns, 10) / 10;
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t);
  return {
    ...BALLOON_CONFIG,
    timeLimitMs: lerp(60_000, 45_000),
    passThreshold: lerp(10, 18),
    firstWallSpikeAt: lerp(5, 2),
    spikeRampEvery: Math.max(1, lerp(3, 1)),
  };
}
