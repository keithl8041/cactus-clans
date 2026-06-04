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
  /** Optional in-game pickups (e.g. golden stars). Added straight to the score. */
  bonusPoints?: number;
}

export interface LevelInstructions {
  objective: string;
  controls: { label: string; value: string }[];
  tips?: string[];
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

  /** Pre-game briefing: objective, controls, optional tips. */
  instructions: LevelInstructions;

  /** Build the Phaser scene for this level given runtime context. */
  buildScene: (ctx: LevelContext) => Phaser.Scene;

  /** Combined leaderboard score: hybrid of points and elapsed seconds. */
  scoreFor: (r: LevelResult) => number;
}

/**
 * Default hybrid scoring rule: 10 points per mini-game point, plus any bonus
 * pickups, minus elapsed seconds. Failed runs still score — pass simply gates
 * progression, not the leaderboard entry.
 */
export function defaultScoreFor(r: LevelResult): number {
  const bonus = r.bonusPoints ?? 0;
  return Math.max(0, r.miniGamePoints * 10 + bonus - Math.floor(r.elapsedMs / 1000));
}

export function scaledDefaultScoreFor(scoreMultiplier: number): (r: LevelResult) => number {
  return (r: LevelResult) => {
    const bonus = r.bonusPoints ?? 0;
    const scaledPoints = Math.round((r.miniGamePoints * 10 + bonus) * scoreMultiplier);
    return Math.max(0, scaledPoints - Math.floor(r.elapsedMs / 1000));
  };
}
