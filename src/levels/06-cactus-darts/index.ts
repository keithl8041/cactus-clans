import { defaultScoreFor, type LevelDefinition } from '../types';
import { CactusDartsScene } from './CactusDartsScene';
import { CACTUS_DARTS_CONFIG } from './config';

export const cactusDartsLevel: LevelDefinition = {
  id: '06-cactus-darts',
  number: 6,
  title: 'Cactus Dart Toss',
  blurb: 'Sling cactus spikes at the dartboard. Pull back to aim — bullseyes are worth the most!',
  passThreshold: CACTUS_DARTS_CONFIG.passThreshold,
  instructions: {
    objective: `You get ${CACTUS_DARTS_CONFIG.quiverSize} cacti — score ${CACTUS_DARTS_CONFIG.passThreshold} points before they run out to clear the level. Outer ring is ${CACTUS_DARTS_CONFIG.ringPoints.outer}, middle is ${CACTUS_DARTS_CONFIG.ringPoints.middle}, bullseye is ${CACTUS_DARTS_CONFIG.ringPoints.bullseye}.`,
    controls: [
      { label: 'Aim & power', value: 'Swipe anywhere on screen in the direction you want to throw — the longer the swipe, the more power. Release to fire.' },
      { label: 'Keyboard', value: '↑ / ↓ to aim, ← / → to set power, hold Space to ready and release to throw.' },
    ],
    tips: [
      'You can start your swipe anywhere — drag in the direction the spike should fly.',
      'The dotted line previews the arc; line it up with the dartboard before you release.',
      'Each hit pushes the dartboard further away, and it starts drifting up and down after the second hit.',
      'Bullseyes are worth five — go for them when the board is still close.',
    ],
  },
  buildScene: (ctx) => new CactusDartsScene(ctx),
  scoreFor: defaultScoreFor,
};
