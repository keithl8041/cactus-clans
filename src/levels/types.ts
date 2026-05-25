import type Phaser from 'phaser';
import type { Clan } from '../data/clans';
import type { PlayerSession } from '../services/session';

/**
 * Runtime context handed to a level's Phaser scene. The scene fires
 * `onComplete` (with a result) when the player passes/fails, or `onAbort` if
 * the player chooses to back out. The shell handles navigation + persistence.
 */
export interface LevelContext {
  player: PlayerSession;
  clan: Clan;
  /** The form the player is fighting to become (1..8 == this level number). */
  formNumber: number;
  onComplete: (result: LevelResult) => void;
  onAbort: () => void;
}

export interface LevelResult {
  passed: boolean;
  miniGamePoints: number;
  elapsedMs: number;
}

/**
 * The plugin contract every mini-game must implement. Drop a folder under
 * `src/levels/` exporting a LevelDefinition, append it to `registry.ts`, and
 * the shell can already run it. No other code changes needed.
 */
export interface LevelDefinition {
  id: string;          // stable slug, e.g. "01-balloon-keepy-uppy"
  number: number;      // 1..8
  title: string;
  blurb: string;       // one-line teaser for the level map
  passThreshold: number; // mini-game-specific points required to pass

  /** Build the Phaser scene for this level given runtime context. */
  buildScene: (ctx: LevelContext) => Phaser.Scene;

  /** Combined leaderboard score: hybrid of points and elapsed seconds. */
  scoreFor: (r: LevelResult) => number;
}

/** Default hybrid scoring rule: 10 points per mini-game point, minus elapsed seconds. */
export function defaultScoreFor(r: LevelResult): number {
  if (!r.passed) return 0;
  return Math.max(0, r.miniGamePoints * 10 - Math.floor(r.elapsedMs / 1000));
}
