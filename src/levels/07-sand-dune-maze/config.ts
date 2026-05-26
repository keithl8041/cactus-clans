// Tuning constants for the sand-dune maze level. Tweak freely.

export const DUNE_MAZE_CONFIG = {
  // Win condition
  passThreshold: 30,                // base reward for reaching the exit
  timerSeconds: 45,                 // race timer

  // Map grid
  tileSize: 48,                     // px per tile
  mapCols: 23,                      // odd — backtracker needs odd dimensions
  mapRows: 15,

  // Entity counts (set by the generator after carving)
  artifactCount: 3,
  trapCount: 4,
  quicksandCount: 4,

  // Player
  playerSize: 36,
  playerBodyScale: 0.65,            // body collider as fraction of sprite size
  playerMaxSpeed: 220,              // px/sec on dry sand
  playerAccel: 1400,                // px/sec²
  playerDrag: 1400,                 // px/sec² when no input

  // Hazards
  quicksandSpeedMult: 0.45,
  quicksandTimerDrainMult: 1.6,
  quicksandSize: 44,
  trapSize: 32,
  trapRevealRadius: 120,
  trapRevealMs: 250,
  trapPostQuicksandGraceMs: 100,

  // Pickups + scoring
  artifactSize: 36,
  artifactBonusPoints: 15,
  exitBaseReward: 30,
  timeBonusPerSecond: 2,

  // Camera
  cameraLerp: 0.12,
  cameraDeadzoneFrac: 0.20,

  // Compass + breadcrumbs (kid wayfinding)
  compassIdleMs: 2500,
  breadcrumbIntervalMs: 350,
  breadcrumbLifetimeMs: 6000,

  // Background
  backgroundColor: 0x4a3a26,
} as const;
