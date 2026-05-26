import type { LevelDefinition } from './types';
import { balloonLevel } from './01-balloon-keepy-uppy';
import { cactusDartsLevel } from './02-cactus-darts';
import { lizardWhackLevel } from './03-lizard-whack';
import { cactusCareLevel } from './04-cactus-care';
import { cactusSlicingLevel } from './05-cactus-slicing';

// Full level registry — includes Phaser scene factories. Imported only from
// the lazy GameContainer so Phaser stays out of the main bundle.
//
// Append new level definitions here and add a matching entry to ./meta.ts.
export const LEVELS: LevelDefinition[] = [
  balloonLevel,
  cactusDartsLevel,
  lizardWhackLevel,
  cactusCareLevel,
  cactusSlicingLevel,
];

export function levelByNumber(n: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.number === n);
}
