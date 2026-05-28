import { defaultScoreFor, type LevelDefinition } from '../types';
import { CamelRaceScene } from './CamelRaceScene';
import { CAMEL_RACE_CONFIG } from './config';

export const camelRaceLevel: LevelDefinition = {
  id: '02-camel-race',
  number: 2,
  title: 'Camel Sprint',
  blurb: 'Race your camel across the dunes. Tap to switch lanes; hold to dash and grab water.',
  passThreshold: CAMEL_RACE_CONFIG.passThreshold,
  instructions: {
    objective: `Race to the finish line before time runs out (${Math.round(CAMEL_RACE_CONFIG.courseTimeLimitMs / 1000)}s). Reach at least ${Math.round(CAMEL_RACE_CONFIG.passDistanceFraction * 100)}% of the course to clear the level. Dodge rocks and cacti; grab water flasks for stamina.`,
    controls: [
      { label: 'Switch lanes', value: 'Tap the left or right half of the screen · ← → or A / D (keyboard). One tap = one lane shift.' },
      { label: 'Dash', value: 'Hold any pointer for sustained dash; quick tap fires a short burst · Space, W, or ↑ (keyboard).' },
    ],
    tips: [
      'Two thumbs work great — left thumb steers left lane, right thumb steers right (and either holds to dash).',
      'Pick up water flasks to refill stamina — running out drops you to a slow trot.',
      'Hitting an obstacle costs stamina and slows you down briefly — but it is not instant fail.',
      'Obstacles get denser and the camel runs faster the further you get. Save dashes for clear stretches.',
    ],
  },
  buildScene: (ctx) => new CamelRaceScene(ctx),
  scoreFor: defaultScoreFor,
};
