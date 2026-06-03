import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, highestClearedLevel } from '../store/gameStore';
import { clanByName } from '../data/clans';
import { cardFor } from '../data/cards';
import { assetUrl, resolveCharacterKey } from '../assets/manifest';
import { levelMetaByNumber, MAX_LEVEL } from '../levels/meta';
import { clearActiveRun, completeRun } from '../services/progress';
import { submitMockRun } from '../services/leaderboard';
import { usingRealBackend } from '../services/api';

export function LevelMap() {
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const run = useGameStore((s) => s.run);
  const setRun = useGameStore((s) => s.setRun);

  useEffect(() => {
    if (!player) navigate('/nickname');
    else if (!run) navigate('/clans');
  }, [player, run, navigate]);

  if (!player || !run) return null;

  // Test convenience: on localhost, every level is playable regardless of
  // progress so we can jump straight to any mini-game. Real deploys are gated.
  const devUnlockAll =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  const clan = clanByName(run.clan);
  const cleared = highestClearedLevel(run);
  const currentForm = Math.min(cleared + 1, MAX_LEVEL);
  const card = clan ? cardFor(clan.name, currentForm) : undefined;
  const characterUrl = clan
    ? assetUrl(resolveCharacterKey(clan.name, currentForm), {
        clanColor: clan.color,
        formNumber: currentForm,
        size: 140,
      })
    : '';

  async function finishRun() {
    if (!run || run.completedAt) return;
    const final = await completeRun(run);
    setRun(final);
    if (!usingRealBackend && player) {
      submitMockRun({
        playerId: player.id,
        nickname: player.nickname,
        clan: final.clan,
        totalScore: final.totalScore,
        completedAt: final.completedAt,
      });
    }
    navigate('/leaderboard');
  }

  function startNewRun() {
    if (!player) return;
    const ok = window.confirm(
      'Start a fresh run? Your completed run stays on the leaderboard.',
    );
    if (!ok) return;
    clearActiveRun(player.id);
    setRun(null);
    navigate('/clans');
  }

  return (
    <div className="screen">
      <h1>{run.clan}</h1>
      <h2>
        Form {currentForm} of {MAX_LEVEL}: {card?.name ?? '???'}
      </h2>
      {characterUrl && <img src={characterUrl} alt={`Form ${currentForm}`} width={140} style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' }} />}
      <div style={{ maxWidth: 480, color: 'var(--text-dim)' }}>{card?.description}</div>

      <div className="level-track">
        {Array.from({ length: MAX_LEVEL }).map((_, i) => {
          const n = i + 1;
          const level = levelMetaByNumber(n);
          let cls = 'level-node';
          if (n <= cleared) cls += ' cleared';
          else if (n === cleared + 1) cls += ' current';
          else if (!devUnlockAll) cls += ' locked';
          const clickable = level != null && (devUnlockAll || n <= cleared + 1);
          const titleText = level
            ? n <= cleared
              ? `${level.title} (replay)`
              : level.title
            : `Level ${n} (coming soon)`;
          return (
            <div
              key={n}
              className={cls}
              title={titleText}
              style={clickable ? { cursor: 'pointer' } : undefined}
              onClick={() => clickable && navigate(`/play/${n}`)}
            >
              {n}
            </div>
          );
        })}
      </div>

      <div style={{ color: 'var(--text-dim)', maxWidth: 480 }}>
        Total run score: <strong style={{ color: 'var(--accent)' }}>{run.totalScore}</strong>
        {run.completedAt && <> · Completed. Replays are practice only.</>}
      </div>

      <div className="row">
        <button onClick={() => navigate('/game', { state: { pickPlayer: true } })}>Switch player</button>
        {cleared >= MAX_LEVEL && !run.completedAt && (
          <button className="primary" onClick={finishRun}>Submit run</button>
        )}
        {run.completedAt && (
          <button className="primary" onClick={startNewRun}>Start a new run</button>
        )}
        <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
      </div>
    </div>
  );
}
