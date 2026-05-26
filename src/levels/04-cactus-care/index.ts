import { defaultScoreFor, type LevelDefinition } from '../types';
import { CactusCareScene } from './CactusCareScene';
import { CACTUS_CARE_CONFIG } from './config';

export const cactusCareLevel: LevelDefinition = {
  id: '04-cactus-care',
  number: 4,
  title: 'Cactus Care',
  blurb: 'Keep your pet cactus happy. Water it just enough — not too dry, not too soaked.',
  passThreshold: CACTUS_CARE_CONFIG.passThreshold,
  instructions: {
    objective: `Keep the moisture meter in the green band for ${CACTUS_CARE_CONFIG.passThreshold} seconds before the ${Math.round(CACTUS_CARE_CONFIG.surviveMs / 1000)}-second timer runs out.`,
    controls: [
      { label: 'Water', value: 'Press and hold over the cactus — the watering can follows your finger. Lift to stop.' },
      { label: 'Keyboard', value: 'Arrow keys move the can, hold Space to pour.' },
    ],
    tips: [
      'The meter drifts down on its own — top it up before it goes red.',
      'Sun blasts speed up drying; rain showers fill the meter fast. Adjust!',
      'Hovering in the centre of the green band scores bonus points.',
      'Over-watering pegs the meter full — back off when rain arrives or your cactus drowns.',
    ],
  },
  buildScene: (ctx) => new CactusCareScene(ctx),
  scoreFor: defaultScoreFor,
};
