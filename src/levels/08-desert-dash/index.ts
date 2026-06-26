import { scaledDefaultScoreFor, type LevelDefinition } from '../types';
import { DesertDashScene } from './DesertDashScene';
import { DESERT_DASH_CONFIG } from './config';

export const desertDashLevel: LevelDefinition = {
  id: '08-desert-dash',
  number: 8,
  title: 'Desert Dash',
  blurb: 'Sprint across the dunes, then face the Giant Sand Tarantula. Stomp it three times to win the journey!',
  passThreshold: DESERT_DASH_CONFIG.passThreshold,
  instructions: {
    objective: `Run, jump, and dodge across the dunes — then defeat the Giant Sand Tarantula at the end. You have ${DESERT_DASH_CONFIG.startingLives} lives. Stomp the boss to win the grand finale.`,
    controls: [
      { label: 'Jump', value: 'Tap the ↑ button on the right · Space, W, or ↑ on the keyboard' },
      { label: 'Double jump', value: 'Tap again mid-air for a second, smaller jump — clear stacked obstacles and grab high stars' },
      { label: 'Boss arena', value: 'Hold the left or right half of the screen to dodge · ← → or A / D on the keyboard' },
    ],
    tips: [
      'Boss attack pattern: it rears up (telegraph), leaps at you, then sits stunned. That\'s your stomp window — land on its back!',
      'A spike-spit attack flies low and fast — just jump over it.',
      'High stars need a double-jump near the peak of your first jump.',
      'Watch the floor: paired cacti or rock+cactus combos appear later — double-jump them or thread the gap.',
    ],
  },
  buildScene: (ctx) => new DesertDashScene(ctx),
  scoreFor: scaledDefaultScoreFor(0.49),
};
