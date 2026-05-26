// Lightweight per-level metadata, importable from the React shell without
// pulling in Phaser. The full registry (which includes scene factories) lives
// in `./registry` and is only imported from the lazy GameContainer.

export interface LevelMeta {
  id: string;
  number: number;
  title: string;
  blurb: string;
  passThreshold: number;
}

export const LEVEL_META: LevelMeta[] = [
  {
    id: '01-balloon-keepy-uppy',
    number: 1,
    title: 'Balloon Keepy-Uppy',
    blurb: 'Tap to keep the balloon airborne. Watch out for cactus spikes!',
    passThreshold: 15,
  },
  {
    id: '02-cactus-darts',
    number: 2,
    title: 'Cactus Dart Toss',
    blurb: 'Sling cactus spikes at the dartboard. Bullseyes count for the most.',
    passThreshold: 12,
  },
  {
    id: '03-lizard-whack',
    number: 3,
    title: 'Lizard Whack-a-Mole',
    blurb: 'Tap the lizards as they pop out of the cactus pots — quick taps score more!',
    passThreshold: 18, // keep in sync with LIZARD_WHACK_CONFIG.passThreshold
  },
  {
    id: '04-cactus-care',
    number: 4,
    title: 'Cactus Care',
    blurb: 'Keep your pet cactus happy. Water it just enough — not too dry, not too soaked.',
    passThreshold: 24, // keep in sync with CACTUS_CARE_CONFIG.passThreshold
  },
  {
    id: '05-cactus-slicing',
    number: 5,
    title: 'Cactus Slicing',
    blurb: 'Slash flying cacti — but watch out for tarantulas!',
    passThreshold: 45, // keep in sync with CACTUS_SLICING_CONFIG.passThreshold
  },
  {
    id: '06-camel-race',
    number: 6,
    title: 'Camel Sprint',
    blurb: 'Race your camel across the dunes. Tap to switch lanes; hold to dash and grab water.',
    passThreshold: 153, // keep in sync with CAMEL_RACE_CONFIG.passThreshold
  },
  {
    id: '07-sand-dune-maze',
    number: 7,
    title: 'Sand Dune Maze',
    blurb: 'Find your way through the dunes — dodge quicksand and trip-spikes, grab artifacts for bonus points!',
    passThreshold: 30, // keep in sync with DUNE_MAZE_CONFIG.passThreshold
  },
  {
    id: '08-desert-dash',
    number: 8,
    title: 'Desert Dash',
    blurb: 'Sprint across the dunes, then face the Giant Sand Tarantula. Stomp it three times to win the journey!',
    passThreshold: 100, // keep in sync with DESERT_DASH_CONFIG.passThreshold
  },
];

export const MAX_LEVEL = 8;

export function levelMetaByNumber(n: number): LevelMeta | undefined {
  return LEVEL_META.find((l) => l.number === n);
}
