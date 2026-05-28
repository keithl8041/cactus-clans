// Tuning constants for the desert-dash level (Sonic/Mario-style endless runner
// with a boss fight finale). Tweak freely.

export const DESERT_DASH_CONFIG = {
  // Win condition (running phase + boss phase total)
  passThreshold: 100,                  // ~runningDistancePx/100; the leaderboard score uses Math.floor(distance/100)
  runningDistancePx: 9_600,            // length of the auto-scroll phase before the boss arena
  bossOutroDistancePx: 1_200,          // extra ground that scrolls after boss defeat to the finish line
  totalDistancePx: 10_800,             // runningDistancePx + bossOutroDistancePx — used for leaderboard math
  courseTimeLimitMs: 110_000,          // hard cap on the whole level
  passDistanceFraction: 0.80,          // unlock latches at this fraction of runningDistancePx
  startingLives: 3,

  // Player physics (Arcade physics — gravity for jumping)
  playerSize: 96,
  playerXFraction: 0.22,               // x-position during running phase (world scrolls past)
  bossPlayerMinXFraction: 0.04,        // movement bounds during boss phase
  bossPlayerMaxXFraction: 0.96,
  bossPlayerMoveSpeed: 320,            // horizontal speed during boss phase
  gravity: 1800,
  jumpImpulse: -680,                   // first jump
  doubleJumpImpulse: -560,             // second (mid-air) jump
  playerMaxFallSpeed: 1200,
  groundedY: 0,                        // computed at runtime as height - floorPaddingPx - playerSize/2

  // Scroll speed
  baseSpeed: 260,                      // px/sec at start of run
  baseSpeedFinal: 360,                 // px/sec at the end of the running phase
  hitSpeedMult: 0.55,                  // multiplier for hitSpeedPenaltyMs after a hit
  hitSpeedPenaltyMs: 700,

  // Hit feedback
  hitIframesMs: 1000,                  // i-frames after losing a life

  // Obstacles (running phase)
  obstacleWarmupPx: 900,               // grace period at start before first obstacle
  obstacleBaseGapPx: 480,
  obstacleEndGapPx: 280,
  obstaclePairChance: 0.22,            // chance of spawning two side-by-side
  obstaclePairSpacingPx: 95,           // worldX gap inside a pair
  obstacleRockChance: 0.5,
  obstacleSize: 80,
  obstacleColliderXPx: 50,             // ±x distance from player center for collision check
  obstacleColliderYPx: 60,             // y overlap threshold

  // Stars (collectibles during running phase)
  starWarmupPx: 600,
  starSpawnEveryPx: 700,
  starSpawnJitter: 0.30,
  starSize: 56,
  starBonusPoints: 5,
  starHighYFraction: 0.40,             // require double-jump (height of canvas)
  starLowYFraction: 0.55,
  starHighChance: 0.45,                // chance a star spawns high vs low
  starColliderRadiusPx: 50,

  // Jump button (reuses Balloon pattern)
  jumpButtonRadius: 56,
  jumpButtonMargin: 18,

  // Ground / sky
  floorPaddingPx: 60,                  // visible sand strip height
  skyHeightFraction: 0.62,

  // Parallax scroll multipliers
  parallaxFarMult: 0.12,
  parallaxMidMult: 0.35,
  parallaxNearMult: 0.85,

  // Background palette (sunset to differentiate from L6's dusk-blue and L7's sand)
  backgroundColor: 0x6a3a5a,
  groundColor: 0xc88a55,

  // ----- Boss phase -----
  bossHp: 3,
  bossSize: 180,                       // tarantula scaled big
  bossArenaXFraction: 0.78,            // boss home position (x)
  bossGroundYOffset: 18,               // raise off the floor a touch
  bossIntroMs: 1100,                   // boss skitter-in animation
  bossTelegraphMs: 700,                // rear-up wind-up before the leap
  bossLeapMs: 950,                     // time of the leap arc
  bossLeapPeakOffsetPx: 220,           // peak height of the leap above ground
  bossLandHoldMs: 1300,                // window where boss is grounded and stompable
  bossReturnMs: 700,                   // skitter back to home position
  bossStompYThreshold: 60,             // player must be above the boss top by less than this to stomp
  bossStompPlayerVy: 60,               // require player to be moving downward (vy > this) for a stomp
  bossStompXTolerancePx: 90,           // ±x tolerance for stomp/contact
  bossDamageIframesMs: 900,            // boss flashes invulnerable after a stomp
  bossDefeatedDelayMs: 1500,           // pause showing defeated state before scroll resumes

  // Spike spit attack (high projectile — player must NOT jump into it).
  bossSpitMs: 1200,                    // travel time across the arena
  bossSpitSpeed: 520,                  // px/sec horizontal projectile speed (leftward)
  bossSpitColliderRadiusPx: 38,
  bossSpitSize: 56,

  // Cactus lob attack (low projectile that arcs then rolls along the ground —
  // player must JUMP over it). Cycles after leap and spit.
  bossLobSize: 60,
  bossLobLaunchVx: -360,               // initial leftward velocity at toss
  bossLobLaunchVy: -560,               // initial upward velocity at toss
  bossLobGravity: 1800,                // px/sec² applied to the lob in-flight
  bossLobRollSpeed: -340,              // leftward roll speed once landed
  bossLobColliderRadiusPx: 34,
  bossLobDoubleChance: 0.55,           // chance the boss tosses a second cactus
  bossLobSecondDelayMs: 380,           // delay before the second cactus
  bossLobCycleMs: 1800,                // substate duration before the next attack begins

  // Boss UI
  bossHealthBarWidthPx: 220,
  bossHealthBarHeightPx: 16,
  bossHealthBarYPx: 70,
} as const;
