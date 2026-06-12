import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { levelByNumber } from '../levels/registry';
import type { Clan } from '../data/clans';
import type { PlayerSession } from '../services/session';
import type { LevelResult } from '../levels/types';
import { RotateOverlay } from './RotateOverlay';
import { useNeedsRotate } from './useNeedsRotate';
import { InstructionsModal } from './InstructionsModal';
import { enterFullscreen } from './fullscreen';
import { trackEvent } from '../services/analytics';

interface Props {
  player: PlayerSession;
  clan: Clan;
  levelNumber: number;
  onComplete: (score: number) => void;
  onAbort: () => void;
}

interface FinishedState {
  passed: boolean;
  miniGamePoints: number;
  elapsedMs: number;
  bonusPoints: number;
  score: number;
}

/**
 * Phaser game wrapper for the demo mode. Mounts the requested level once —
 * no retry, no run management, no game-store writes. On completion it calls
 * `onComplete(score)`; on abort it calls `onAbort()`.
 *
 * This file imports Phaser directly. It is only ever imported from Demo.tsx,
 * which is itself lazy-loaded from App.tsx, so Phaser stays out of the main
 * bundle.
 */
export function DemoGame({ player, clan, levelNumber, onComplete, onAbort }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState<FinishedState | null>(null);
  const needsRotate = useNeedsRotate();

  // Keep stable refs for the callbacks so the Phaser effect doesn't need to
  // re-run when the parent re-renders with new function instances.
  const onCompleteRef = useRef(onComplete);
  const onAbortRef = useRef(onAbort);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onAbortRef.current = onAbort; }, [onAbort]);

  const level = levelByNumber(levelNumber);

  useEffect(() => {
    if (!level || !started || finished) return;
    if (!hostRef.current) return;

    let cancelled = false;

    const handleResult = (result: LevelResult) => {
      if (cancelled) return;
      const score = level.scoreFor(result);
      trackEvent('level_complete', {
        level_number: level.number,
        level_title: level.title,
        clan: clan.name,
        passed: result.passed,
        score,
        mini_game_points: result.miniGamePoints,
        elapsed_ms: result.elapsedMs,
        attempt: 1,
        practice: false,
      });
      if (!cancelled) {
        setFinished({
          passed: result.passed,
          miniGamePoints: result.miniGamePoints,
          elapsedMs: result.elapsedMs,
          bonusPoints: result.bonusPoints ?? 0,
          score,
        });
      }
    };

    const scene = level.buildScene({
      player,
      clan,
      formNumber: level.number,
      onComplete: handleResult,
      onAbort: () => onAbortRef.current(),
      demo: true,
    });

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      backgroundColor: '#16291c',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1280,
        height: 720,
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      scene,
    });
    gameRef.current = game;

    return () => {
      cancelled = true;
      game.destroy(true);
      gameRef.current = null;
    };
  }, [player, clan, level, started, finished]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (needsRotate) {
      game.scene.scenes.forEach((s) => s.scene.pause());
    } else {
      game.scene.scenes.forEach((s) => s.scene.resume());
    }
  }, [needsRotate]);


  if (!level) return null;

  return (
    <div className="game-canvas-wrap">
      <div className="hud">
        <span className="pill">Demo · {level.title}</span>
        <span className="pill">Pass: {level.passThreshold}</span>
      </div>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      <RotateOverlay active={needsRotate} />
      {!started && !finished && (
        <InstructionsModal
          levelNumber={level.number}
          title={level.title}
          passThreshold={level.passThreshold}
          instructions={level.instructions}
          onStart={() => {
            setStarted(true);
            trackEvent('level_start', {
              level_number: level.number,
              level_title: level.title,
              clan: clan.name,
              practice: false,
            });
            void enterFullscreen();
          }}
          onCancel={() => onAbortRef.current()}
          cancelLabel="Cancel"
        />
      )}
      {finished && (
        <div className="screen" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }}>
          <h1 style={{ color: finished.passed ? 'var(--accent)' : 'var(--danger)' }}>
            {finished.passed ? 'Cleared!' : 'Nice try!'}
          </h1>
          <h2>
            {finished.miniGamePoints} hits
            {finished.bonusPoints > 0 && ` · ★ +${finished.bonusPoints}`}
            {' · '}
            {(finished.elapsedMs / 1000).toFixed(1)}s · score {finished.score}
          </h2>
          <button className="primary" onClick={() => onCompleteRef.current(finished.score)} autoFocus>
            See the leaderboard →
          </button>
        </div>
      )}
    </div>
  );
}
