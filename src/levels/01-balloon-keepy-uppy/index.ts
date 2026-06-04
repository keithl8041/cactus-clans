import { scaledDefaultScoreFor, type LevelDefinition } from '../types';
import { BalloonScene } from './BalloonScene';
import { BALLOON_CONFIG } from './config';

export const balloonLevel: LevelDefinition = {
  id: '01-balloon-keepy-uppy',
  number: 1,
  title: 'Balloon Keepy-Uppy',
  blurb: 'Bounce the balloon off your head. Tap to jump, hold left/right to move — keep it off the spikes!',
  passThreshold: BALLOON_CONFIG.passThreshold,
  instructions: {
    objective: `Head-bonk the balloon ${BALLOON_CONFIG.passThreshold} times within ${BALLOON_CONFIG.timeLimitMs / 1000} seconds without letting it touch the ground or any cactus spike. Once the level is unlocked, any extra hits before the timer expires boost your score.`,
    controls: [
      { label: 'Move', value: 'Hold the left or right half of the screen · ← → or A / D (keyboard)' },
      { label: 'Jump', value: 'Tap the ↑ button or swipe up anywhere (touch) · Space, W, or ↑ (keyboard)' },
    ],
    tips: [
      'Two fingers work great — hold one side to steer and tap with the other to jump.',
      'Off-center contact sends the balloon sideways — aim your head like a Breakout paddle.',
      'Jumping into the balloon launches it higher than a standing bounce.',
      'Wind gusts get stronger over time, and spikes start appearing on the walls and ceiling.',
    ],
  },
  buildScene: (ctx) => new BalloonScene(ctx),
  scoreFor: scaledDefaultScoreFor(2.3),
};
