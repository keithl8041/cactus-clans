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
    passThreshold: 20,
  },
  {
    id: '02-cactus-darts',
    number: 2,
    title: 'Cactus Dart Toss',
    blurb: 'Sling cactus spikes at the dartboard. Bullseyes count for the most.',
    passThreshold: 12,
  },
];

export const MAX_LEVEL = 8;

export function levelMetaByNumber(n: number): LevelMeta | undefined {
  return LEVEL_META.find((l) => l.number === n);
}
