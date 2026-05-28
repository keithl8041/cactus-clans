import type { LevelDefinition } from './types';
import { balloonLevel } from './01-balloon-keepy-uppy';
import { camelRaceLevel } from './02-camel-race';
import { lizardWhackLevel } from './03-lizard-whack';
import { cactusCareLevel } from './04-cactus-care';
import { cactusSlicingLevel } from './05-cactus-slicing';
import { cactusDartsLevel } from './06-cactus-darts';
import { duneMazeLevel } from './07-sand-dune-maze';
import { desertDashLevel } from './08-desert-dash';

// Full level registry — includes Phaser scene factories. Imported only from
// the lazy GameContainer so Phaser stays out of the main bundle.
//
// Append new level definitions here and add a matching entry to ./meta.ts.
export const LEVELS: LevelDefinition[] = [
  balloonLevel,
  camelRaceLevel,
  lizardWhackLevel,
  cactusCareLevel,
  cactusSlicingLevel,
  cactusDartsLevel,
  duneMazeLevel,
  desertDashLevel,
];

export function levelByNumber(n: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.number === n);
}
