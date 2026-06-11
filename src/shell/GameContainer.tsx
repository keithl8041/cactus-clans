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
import { trackEvent } from '../services/analytics';
import type { LevelResult } from '../levels/types';
import { RotateOverlay } from './RotateOverlay';
import { useNeedsRotate } from './useNeedsRotate';
import { InstructionsModal } from './InstructionsModal';
import { EvolutionInterstitial } from './EvolutionInterstitial';
import { Confetti } from './Confetti';
import { enterFullscreen, exitFullscreen, isTouchDevice } from './fullscreen';
import { MAX_LEVEL } from '../levels/meta';
import { assetUrl, resolveCharacterKey } from '../assets/manifest';

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
  const runRef = useRef(run);
  const [finished, setFinished] = useState<FinishedState | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const [showEvolution, setShowEvolution] = useState(false);
  const needsRotate = useNeedsRotate();

  const n = Number(levelNumber);
  const level = Number.isFinite(n) ? levelByNumber(n) : undefined;

  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    const currentRun = runRef.current;
    if (!player || !currentRun) {
      navigate('/');
      return;
    }
    if (!level) {
      navigate('/journey');
      return;
    }
    const clan = clanByName(currentRun.clan);
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
      trackEvent('level_complete', {
        level_number: level.number,
        level_title: level.title,
        passed: result.passed,
        score,
        mini_game_points: result.miniGamePoints,
        elapsed_ms: result.elapsedMs,
        attempt: attempt + 1,
        practice: !!currentRun.completedAt,
      });
      const next = await recordLevelResult(currentRun, {
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
          currentLevel: next.completedAt ? undefined : level.number,
        });
      }
      if (!cancelled) {
        runRef.current = next;
        setFinished({
          passed: result.passed,
          miniGamePoints: result.miniGamePoints,
          elapsedMs: result.elapsedMs,
          bonusPoints: result.bonusPoints ?? 0,
          score,
        });
        setRun(next);
      }
    };

    const scene = level.buildScene({
      player,
      clan,
      formNumber: level.number,
      onComplete: handleResult,
      onAbort: () => {
        trackEvent('level_quit', {
          level_number: level.number,
          level_title: level.title,
          attempt: attempt + 1,
          practice: !!currentRun.completedAt,
        });
        navigate('/journey');
      },
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
  }, [player, level, navigate, setRun, finished, attempt, started]);

  useEffect(() => {
    const game = gameRef.current;
    if (!game) return;
    if (needsRotate) {
      game.scene.scenes.forEach((s) => s.scene.pause());
    } else {
      game.scene.scenes.forEach((s) => s.scene.resume());
    }
  }, [needsRotate, attempt]);

  // Drop out of fullscreen when leaving the level entirely (not on retry / not
  // when the result overlay shows — those stay in fullscreen so the page can't
  // jiggle back to showing the URL bar between attempts).
  useEffect(() => {
    return () => {
      void exitFullscreen();
    };
  }, []);

  function retry() {
    setFinished(null);
    setAttempt((a) => a + 1);
  }

  // Form N → N+1 on pass (level.number is the form you just became — see LevelMap).
  const fromForm = level ? level.number : 0;
  const toForm = Math.min(fromForm + 1, MAX_LEVEL);
  const hasEvolution = toForm > fromForm;

  function continueFromResult() {
    if (finished?.passed && hasEvolution) {
      setShowEvolution(true);
    } else {
      navigate('/journey');
    }
  }

  useEffect(() => {
    if (!finished) return;
    if (showEvolution) return; // EvolutionInterstitial owns the keyboard while it's up
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      e.preventDefault();
      if (finished!.passed) continueFromResult();
      else retry();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished, showEvolution, navigate]);

  if (!level) return null;
  const clan = run ? clanByName(run.clan) : undefined;
  const isPractice = !!run?.completedAt;

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
          onStart={() => {
            setStarted(true);
            trackEvent('level_start', {
              level_number: level.number,
              level_title: level.title,
              practice: !!run?.completedAt,
            });
            // Hide mobile browser chrome (URL bar etc) while playing. Must run
            // inside this gesture handler or the browser rejects the request.
            if (isTouchDevice()) void enterFullscreen();
          }}
          onCancel={() => navigate('/journey')}
        />
      )}
      {finished && !showEvolution && (
        <div className="screen" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)' }}>
          {finished.passed && level.number === MAX_LEVEL && !isPractice && <Confetti />}
          {finished.passed && level.number === MAX_LEVEL && !isPractice ? (
            <>
              <h1 className="victory-headline" style={{ fontSize: '2.6rem', textAlign: 'center' }}>
                You beat Cactus Clans!
              </h1>
              {clan && (
                <img
                  src={assetUrl(resolveCharacterKey(clan.name, MAX_LEVEL), { clanColor: clan.color, formNumber: MAX_LEVEL, size: 240 })}
                  alt={`${clan.name} form ${MAX_LEVEL}`}
                  style={{ width: 240, height: 240, objectFit: 'contain', margin: '0 auto' }}
                />
              )}
              <h2 style={{ color: 'var(--accent)', textAlign: 'center' }}>
                The Desert Titan rises. Grand finale cleared.
              </h2>
              <h2 style={{ color: 'var(--text-dim)' }}>
                {finished.miniGamePoints} pts
                {finished.bonusPoints > 0 && ` · ★ +${finished.bonusPoints}`}
                {' · '}
                {(finished.elapsedMs / 1000).toFixed(1)}s · score {finished.score}
              </h2>
            </>
          ) : (
            <>
              <h1 style={{ color: finished.passed ? 'var(--accent)' : 'var(--danger)' }}>
                {finished.passed ? 'Cleared!' : 'Try again'}
              </h1>
              <h2>
                {finished.miniGamePoints} hits
                {finished.bonusPoints > 0 && ` · ★ +${finished.bonusPoints}`}
                {' · '}
                {(finished.elapsedMs / 1000).toFixed(1)}s · score {finished.score}
              </h2>
              {isPractice ? (
                <div style={{ color: 'var(--text-dim)', maxWidth: '24rem', textAlign: 'center' }}>
                  Practice mode — doesn't count toward the leaderboard.
                </div>
              ) : (
                !finished.passed && (
                  <div style={{ color: 'var(--text-dim)', maxWidth: '24rem', textAlign: 'center' }}>
                    Your score still counts — it's on the leaderboard.
                  </div>
                )
              )}
            </>
          )}
          <div className="row">
            {!finished.passed && (
              <button className="primary" onClick={retry} autoFocus>
                Retry (Enter)
              </button>
            )}
            <button
              className={finished.passed ? 'primary' : undefined}
              onClick={finished.passed ? continueFromResult : () => navigate('/journey')}
              autoFocus={finished.passed}
            >
              {finished.passed
                ? level.number === MAX_LEVEL
                  ? 'Back to map (Enter)'
                  : 'Continue (Enter)'
                : 'Back to map'}
            </button>
          </div>
        </div>
      )}
      {showEvolution && clan && (
        <EvolutionInterstitial
          clanName={clan.name}
          clanColor={clan.color}
          fromForm={fromForm}
          toForm={toForm}
          onContinue={() => navigate('/journey')}
        />
      )}
    </div>
  );
}
