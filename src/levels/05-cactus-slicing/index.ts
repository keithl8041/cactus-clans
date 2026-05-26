import { defaultScoreFor, type LevelDefinition } from '../types';
import { CactusSlicingScene } from './CactusSlicingScene';
import { CACTUS_SLICING_CONFIG } from './config';

export const cactusSlicingLevel: LevelDefinition = {
  id: '05-cactus-slicing',
  number: 5,
  title: 'Cactus Slicing',
  blurb: 'Slash flying cacti — but watch out for tarantulas!',
  passThreshold: CACTUS_SLICING_CONFIG.passThreshold,
  instructions: {
    objective: `Swipe to slice flying cacti and reach ${CACTUS_SLICING_CONFIG.passThreshold} points before the ${CACTUS_SLICING_CONFIG.sessionDurationMs / 1000}-second timer runs out. You're allowed ${CACTUS_SLICING_CONFIG.strikeLimit} tarantula strikes — don't slice a fourth one!`,
    controls: [
      { label: 'Slice', value: 'Drag your finger (or mouse) through a cactus to slash it. Connect multiple in one swipe for combo points.' },
      { label: 'Avoid', value: 'Do NOT swipe through tarantulas — each one is a strike.' },
    ],
    tips: [
      'Long, fast swipes hit multiple cacti for combo bonuses (each extra slice in the same swipe is worth more).',
      'Tarantulas mix in with cacti — pick your swipe direction carefully.',
      'The smaller green cacti show up later in the round and need more precise cuts.',
    ],
  },
  buildScene: (ctx) => new CactusSlicingScene(ctx),
  scoreFor: defaultScoreFor,
};
