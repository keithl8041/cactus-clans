import { defaultScoreFor, type LevelDefinition } from '../types';
import { BalloonScene } from './BalloonScene';
import { BALLOON_CONFIG } from './config';

export const balloonLevel: LevelDefinition = {
  id: '01-balloon-keepy-uppy',
  number: 1,
  title: 'Balloon Keepy-Uppy',
  blurb: 'Bounce the balloon off your head. Tap to jump, drag to move — keep it off the spikes!',
  passThreshold: BALLOON_CONFIG.passThreshold,
  instructions: {
    objective: `Head-bonk the balloon ${BALLOON_CONFIG.passThreshold} times without letting it touch the ground or any cactus spike.`,
    controls: [
      { label: 'Move', value: 'Drag left/right (touch) · ← → or A / D (keyboard)' },
      { label: 'Jump', value: 'Tap (touch) · Space, W, or ↑ (keyboard)' },
    ],
    tips: [
      'Off-center contact sends the balloon sideways — aim your head like a Breakout paddle.',
      'Jumping into the balloon launches it higher than a standing bounce.',
      'Wind gusts get stronger over time, and spikes start appearing on the walls and ceiling.',
    ],
  },
  buildScene: (ctx) => new BalloonScene(ctx),
  scoreFor: defaultScoreFor,
};
