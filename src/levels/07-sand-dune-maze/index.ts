import { scaledDefaultScoreFor, type LevelDefinition } from '../types';
import { DuneMazeScene } from './DuneMazeScene';
import { DUNE_MAZE_CONFIG } from './config';

export const duneMazeLevel: LevelDefinition = {
  id: '07-sand-dune-maze',
  number: 7,
  title: 'Sand Dune Maze',
  blurb: 'Find your way through the dunes — dodge quicksand and trip-spikes, grab artifacts for bonus points!',
  passThreshold: DUNE_MAZE_CONFIG.passThreshold,
  instructions: {
    objective: `Reach the exit before time runs out (${DUNE_MAZE_CONFIG.timerSeconds}s). Quicksand slows you and drains the timer faster; trip-spikes end the run. Three artifacts are tucked away for bonus points.`,
    controls: [
      { label: 'Move', value: 'Hold one of the four screen quadrants to walk that direction · arrow keys or WASD' },
      { label: 'Stuck?', value: 'Stand still for a moment — a compass arrow will point toward the exit.' },
    ],
    tips: [
      'Quicksand only slows you — but it also burns your time bonus fast.',
      'Trip-spikes appear when you get close. Slow down in unexplored corridors.',
      'Artifacts are tucked into dead-ends. Skip them if the clock is tight.',
      'Diagonal moves work — combine arrow keys or hold a corner of the screen.',
    ],
  },
  buildScene: (ctx) => new DuneMazeScene(ctx),
  scoreFor: scaledDefaultScoreFor(1.42),
};
