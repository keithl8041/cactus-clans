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
    objective: `Swipe to slice flying cacti and reach ${CACTUS_SLICING_CONFIG.passThreshold} points before the ${CACTUS_SLICING_CONFIG.sessionDurationMs / 1000}-second timer runs out. ${CACTUS_SLICING_CONFIG.strikeLimit} tarantula strikes ends the round — and so does letting ${CACTUS_SLICING_CONFIG.missTolerance} cacti fall past you.`,
    controls: [
      { label: 'Slice', value: 'Drag your finger (or mouse) through a cactus to slash it. Keep the swipe going to chain combos.' },
      { label: 'Avoid', value: 'Do NOT swipe through tarantulas — each one is a strike.' },
    ],
    tips: [
      `Combos only count inside ONE continuous swipe — lift your finger and the combo resets. A clean 5-cactus stroke is worth way more than five separate taps.`,
      `Slice through the centre for a CLEAN cut bonus (+${CACTUS_SLICING_CONFIG.cleanCutBonus}).`,
      `Don't let cacti fall — ${CACTUS_SLICING_CONFIG.missTolerance} drops and it's over.`,
      'Tarantulas mix in with cacti — pick your swipe direction carefully.',
      'Smaller green cacti show up later and need more precise cuts.',
    ],
  },
  buildScene: (ctx) => new CactusSlicingScene(ctx),
  scoreFor: defaultScoreFor,
};
