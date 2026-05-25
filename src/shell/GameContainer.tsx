import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Phaser from 'phaser';
import { levelByNumber } from '../levels/registry';
// importing registry here is fine — GameContainer itself is lazy-loaded.
import { useGameStore } from '../store/gameStore';
import { clanByName } from '../data/clans';
import { recordLevelResult } from '../services/progress';
import type { LevelResult } from '../levels/types';

interface FinishedState {
  passed: boolean;
  miniGamePoints: number;
  elapsedMs: number;
  score: number;
}

export function GameContainer() {
  const { levelNumber } = useParams<{ levelNumber: string }>();
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const run = useGameStore((s) => s.run);
  const setRun = useGameStore((s) => s.setRun);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [finished, setFinished] = useState<FinishedState | null>(null);
  const [attempt, setAttempt] = useState(0);

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
      if (!cancelled) {
        setRun(next);
        setFinished({ ...result, score });
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
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%',
      },
      physics: {
        default: 'arcade',
        arcade: { debug: false },
      },
      scene,
    });

    return () => {
      cancelled = true;
      game.destroy(true);
    };
  }, [player, run, level, navigate, setRun, finished, attempt]);

  if (!level) return null;

  function retry() {
    setFinished(null);
    setAttempt((a) => a + 1);
  }

  return (
    <div className="game-canvas-wrap">
      <div className="hud">
        <span className="pill">Level {level.number}</span>
        <span className="pill">Pass: {level.passThreshold}</span>
      </div>
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      {finished && (
        <div className="screen" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }}>
          <h1 style={{ color: finished.passed ? 'var(--accent)' : 'var(--danger)' }}>
            {finished.passed ? 'Cleared!' : 'Try again'}
          </h1>
          <h2>
            {finished.miniGamePoints} hits · {(finished.elapsedMs / 1000).toFixed(1)}s · score {finished.score}
          </h2>
          <div className="row">
            {!finished.passed && (
              <button className="primary" onClick={retry}>
                Retry
              </button>
            )}
            <button onClick={() => navigate('/journey')}>
              {finished.passed ? 'Continue' : 'Back to map'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
