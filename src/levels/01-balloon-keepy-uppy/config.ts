// Tuning constants for the balloon keepy-uppy level. Tweak freely.

export const BALLOON_CONFIG = {
  passThreshold: 20,            // hits needed to clear
  baseGravity: 320,             // pixels/sec^2
  maxGravity: 540,              // gravity cap as difficulty ramps
  gravityRampPerHit: 8,         // +gravity per successful tap, until cap
  tapImpulse: -360,             // vertical velocity applied on tap
  horizontalNudge: 220,         // pointer-offset horizontal velocity
  maxFallSpeed: 600,            // terminal velocity for the balloon
  startCactusCount: 3,          // initial number of cactus spikes
  cactusEvery: 10,              // add one cactus every N hits
  maxCactusCount: 7,
  balloonSize: 96,
  cactusSize: 80,
  floorPadding: 12,             // distance from canvas bottom where balloon dies
} as const;
