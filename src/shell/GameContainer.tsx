import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Phaser from 'phaser';
import { levelByNumber } from '../levels/registry';
// importing registry here is fine — GameContainer itself is lazy-loaded.
import { useGameStore } from '../store/gameStore';
import { clanByName } from '../data/clans';
import { recordLevelResult } from '../services/progress';
import { submitMockRun } from '../services/leaderboard';
import { usingRealBackend } from '../services/api';
import type { LevelResult } from '../levels/types';
import { RotateOverlay } from './RotateOverlay';
import { useNeedsRotate } from './useNeedsRotate';
import { InstructionsModal } from './InstructionsModal';

interface FinishedState {
  passed: boolean;
  miniGamePoints: number;
  elapsedMs: number;
  bonusPoints: number;
  score: number;
}

export function GameContainer() {
  const { levelNumber } = useParams<{ levelNumber: string }>();
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const run = useGameStore((s) => s.run);
  const setRun = useGameStore((s) => s.setRun);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [finished, setFinished] = useState<FinishedState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const needsRotate = useNeedsRotate();

  const n = Number(levelNumber);
  const level = Number.isFinite(n) ? levelByNumber(n) : undefined;

  useEffect(() => {
    if (!player || !run) {
      navigate('/');
      return;
    }
    if (!level) {
      navigate('/journey');
      return;
    }
    const clan = clanByName(run.clan);
    if (!clan) {
      navigate('/clans');
      return;
    }
    if (!started) return; // wait for instructions dismissal before mounting Phaser
    if (finished) return; // pause Phaser while result overlay is up

    let cancelled = false;
    const handleResult = async (result: LevelResult) => {
      if (cancelled) return;
      const score = level.scoreFor(result);
      const next = await recordLevelResult(run, {
        levelNumber: level.number,
        passed: result.passed,
        miniGamePoints: result.miniGamePoints,
        elapsedMs: result.elapsedMs,
        score,
      });
      if (!usingRealBackend && player) {
        // Keep the local leaderboard in sync after every attempt — pass or fail.
        submitMockRun({
          playerId: player.id,
          nickname: player.nickname,
          clan: next.clan,
          totalScore: next.totalScore,
          completedAt: next.completedAt,
        });
      }
      if (!cancelled) {
        setRun(next);
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
      onAbort: () => navigate('/journey'),
    });

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current!,
      backgroundColor: '#16291c',
      // Fixed logical canvas so the play arena is identical on phone and desktop —
      // FIT scales the canvas down to fit the viewport (letterboxing as needed).
      // Without this the canvas was matching viewport pixels, so a short landscape
      // phone gave the balloon almost no ceiling and play felt cramped.
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
  }, [player, run, level, navigate, setRun, finished, attempt, started]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (needsRotate) {
      game.scene.scenes.forEach((s) => s.scene.pause());
    } else {
      game.scene.scenes.forEach((s) => s.scene.resume());
    }
  }, [needsRotate, attempt]);

  function retry() {
    setFinished(null);
    setAttempt((a) => a + 1);
  }

  useEffect(() => {
    if (!finished) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      if (finished!.passed) navigate('/journey');
      else retry();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finished, navigate]);

  if (!level) return null;

  return (
    <div className="game-canvas-wrap">
      <div className="hud">
        <span className="pill">Level {level.number}</span>
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
          onStart={() => setStarted(true)}
          onCancel={() => navigate('/journey')}
        />
      )}
      {finished && (
        <div className="screen" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }}>
          <h1 style={{ color: finished.passed ? 'var(--accent)' : 'var(--danger)' }}>
            {finished.passed ? 'Cleared!' : 'Try again'}
          </h1>
          <h2>
            {finished.miniGamePoints} hits
            {finished.bonusPoints > 0 && ` · ★ +${finished.bonusPoints}`}
            {' · '}
            {(finished.elapsedMs / 1000).toFixed(1)}s · score {finished.score}
          </h2>
          {!finished.passed && (
            <div style={{ color: 'var(--text-dim)', maxWidth: '24rem', textAlign: 'center' }}>
              Your score still counts — it's on the leaderboard.
            </div>
          )}
          <div className="row">
            {!finished.passed && (
              <button className="primary" onClick={retry} autoFocus>
                Retry (Enter)
              </button>
            )}
            <button
              className={finished.passed ? 'primary' : undefined}
              onClick={() => navigate('/journey')}
              autoFocus={finished.passed}
            >
              {finished.passed ? 'Continue (Enter)' : 'Back to map'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
