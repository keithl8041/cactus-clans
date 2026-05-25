import type { LevelDefinition } from './types';
import { balloonLevel } from './01-balloon-keepy-uppy';

// Full level registry — includes Phaser scene factories. Imported only from
// the lazy GameContainer so Phaser stays out of the main bundle.
//
// Append new level definitions here and add a matching entry to ./meta.ts.
export const LEVELS: LevelDefinition[] = [
  balloonLevel,
];

export function levelByNumber(n: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.number === n);
}
