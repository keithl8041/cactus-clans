import { defaultScoreFor, type LevelDefinition } from '../types';
import { BalloonScene } from './BalloonScene';
import { BALLOON_CONFIG } from './config';

export const balloonLevel: LevelDefinition = {
  id: '01-balloon-keepy-uppy',
  number: 1,
  title: 'Balloon Keepy-Uppy',
  blurb: 'Tap to keep the balloon airborne. Watch out for cactus spikes!',
  passThreshold: BALLOON_CONFIG.passThreshold,
  buildScene: (ctx) => new BalloonScene(ctx),
  scoreFor: defaultScoreFor,
};
