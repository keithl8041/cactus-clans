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
  starHighYFraction: 0.48,             // reachable with a double-jump
  starLowYFraction: 0.63,              // reachable with a single jump
  starHighChance: 0.45,                // chance a star spawns high vs low
  starColliderRadiusPx: 50,

  // Jump button (reuses Balloon pattern)
  jumpButtonRadius: 64,
  jumpButtonMargin: 18,

  // Ground / sky
  floorPaddingPx: 60,                  // visible sand strip height (matches game8-floor.png height)
  // The player and obstacles rest with their base embedded this far below the
  // TOP of the sand strip — i.e. ~2/3 of the way up the 60px strip — so they
  // read as standing in the sand rather than floating on its top edge.
  floorEmbedPx: 20,
  skyHeightFraction: 0.62,

  // Parallax scroll multipliers
  parallaxFarMult: 0.12,
  parallaxMidMult: 0.35,
  parallaxNearMult: 0.85,

  // Background fill behind the parallax layers (the full-canvas parallax PNGs
  // cover this, but it guards against any letterbox/scale gap).
  backgroundColor: 0x6a3a5a,

  // ----- Boss phase -----
  bossHp: 3,
  bossSize: 180,                       // tarantula scaled big
  bossArenaXFraction: 0.78,            // boss home position (x)
  bossGroundYOffset: 0,                // raise off the embedded ground line (keep small — the boss must stay jump-on-able)
  // tarantula.png has ~22% transparent padding below the spider's body, so
  // anchoring by the sprite's bounding box leaves the visible legs floating.
  // Sink the anchor by this fraction of the display height so the visible feet
  // rest on the ground (the transparent padding tucks below the sand line).
  bossArtBottomPadFrac: 0.22,
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
  bossSpitSpeed: 680,                  // px/sec horizontal projectile speed (leftward)
  bossSpitYOffsetMinPx: -96,           // random launch height range relative to boss center
  bossSpitYOffsetMaxPx: -24,
  bossSpitColliderRadiusPx: 38,
  bossSpitSize: 56,

  // Cactus lob attack (low projectile that arcs then rolls along the ground —
  // player must JUMP over it). Cycles after leap and spit.
  bossLobSize: 60,
  bossLobLaunchVx: -420,               // initial leftward velocity at toss
  bossLobLaunchVyMin: -660,            // randomized arc height range
  bossLobLaunchVyMax: -500,
  bossLobGravity: 1800,                // px/sec² applied to the lob in-flight
  bossLobRollSpeed: -420,              // leftward roll speed once landed
  bossLobSpawnYOffsetMinPx: -90,       // random toss height range relative to boss center
  bossLobSpawnYOffsetMaxPx: -45,
  bossLobColliderRadiusPx: 34,
  bossLobDoubleChance: 0.55,           // chance the boss tosses a second cactus
  bossLobSecondDelayMs: 380,           // delay before the second cactus
  bossLobCycleMs: 1800,                // substate duration before the next attack begins

  // Boss UI — the frame is the game8-boss-health-bar.svg art; the red fill is
  // drawn dynamically inside it, inset by these fractions of the frame size.
  bossHealthBarFrameWidthPx: 300,
  bossHealthBarFillInsetXFrac: 0.085,
  bossHealthBarFillInsetYFrac: 0.30,
  bossHealthBarYPx: 70,
} as const;
