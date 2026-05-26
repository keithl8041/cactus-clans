// Tuning constants for the balloon keepy-uppy level. Tweak freely.

export const BALLOON_CONFIG = {
  // Win condition
  passThreshold: 15,

  // World
  baseGravity: 700,             // pixels/sec^2 — applies to player; balloon uses its own gravity
  balloonGravityY: 240,         // balloon's own gravity (slower than player)
  balloonSize: 96,
  cactusSize: 80,
  floorPadding: 12,             // height of sandy floor strip
  maxFallSpeed: 600,            // balloon terminal velocity

  // Player
  playerSize: 96,
  playerMaxSpeed: 360,
  playerMaxFallSpeed: 800,
  playerJumpImpulse: -520,
  playerGroundDrag: 1200,       // horizontal drag when no input (px/sec^2)

  // Input
  tapMoveThresholdPx: 14,       // pointer travel above which a press is treated as a hold, not a tap
  tapMaxMs: 220,                // pointer held longer than this is not a tap

  // Balloon bounce off player
  balloonMaxBounceVX: 280,
  balloonBounceVY: -360,
  jumpBounceBoostThreshold: 60, // |vy| above this means player is mid-jump
  jumpBounceBonusVY: -180,
  hitCooldownMs: 250,

  // Difficulty: spikes
  firstWallSpikeAt: 12,
  spikeRampEvery: 4,
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
