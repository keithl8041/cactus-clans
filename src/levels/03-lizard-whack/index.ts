import { scaledDefaultScoreFor, type LevelDefinition } from '../types';
import { LizardWhackScene } from './LizardWhackScene';
import { LIZARD_WHACK_CONFIG } from './config';

export const lizardWhackLevel: LevelDefinition = {
  id: '03-lizard-whack',
  number: 3,
  title: 'Lizard Whack-a-Mole',
  blurb: 'Tap the lizards as they pop out of the cactus pots — quick taps score more!',
  passThreshold: LIZARD_WHACK_CONFIG.passThreshold,
  instructions: {
    objective: `Whack lizards as they pop up. Score ${LIZARD_WHACK_CONFIG.passThreshold} points before time runs out (${LIZARD_WHACK_CONFIG.roundDurationMs / 1000}s). Catch them quick for ${LIZARD_WHACK_CONFIG.pointsFresh} pts; bandits (the golden ones) are worth ${LIZARD_WHACK_CONFIG.pointsBandit}.`,
    controls: [
      { label: 'Whack', value: 'Tap a lizard the moment it pops out of a pot.' },
      { label: 'Keyboard', value: 'Number keys 1–9 (top-left to bottom-right) hit each pot.' },
    ],
    tips: [
      'Quick whacks (just after pop-up) score 2 — late whacks only score 1.',
      "Golden bandit lizards are worth 5 points and a bonus — don't let them get away.",
      `Don't panic-tap empty pots — they don't cost anything, but you only have ${LIZARD_WHACK_CONFIG.missTolerance} total misses before the round ends.`,
      "Pop-ups get faster as the round goes on, and you'll start seeing two at a time.",
    ],
  },
  buildScene: (ctx) => new LizardWhackScene(ctx),
  scoreFor: scaledDefaultScoreFor(0.67),
};
