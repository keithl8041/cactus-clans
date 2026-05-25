import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore, highestClearedLevel } from '../store/gameStore';
import { clanByName } from '../data/clans';
import { cardFor } from '../data/cards';
import { assetUrl } from '../assets/manifest';
import { levelMetaByNumber, MAX_LEVEL } from '../levels/meta';
import { completeRun } from '../services/progress';
import { submitMockRun } from '../services/leaderboard';
import { usingRealBackend } from '../services/supabase';

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

  const clan = clanByName(run.clan);
  const cleared = highestClearedLevel(run);
  const currentForm = Math.min(cleared + 1, MAX_LEVEL);
  const card = clan ? cardFor(clan.name, currentForm) : undefined;
  const characterUrl = clan ? assetUrl('character', { clanColor: clan.color, formNumber: currentForm, size: 140 }) : '';

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

  return (
    <div className="screen">
      <h1>{run.clan}</h1>
      <h2>
        Form {currentForm} of {MAX_LEVEL}: {card?.name ?? '???'}
      </h2>
      {characterUrl && <img src={characterUrl} alt={`Form ${currentForm}`} style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4))' }} />}
      <div style={{ maxWidth: 480, color: 'var(--text-dim)' }}>{card?.description}</div>

      <div className="level-track">
        {Array.from({ length: MAX_LEVEL }).map((_, i) => {
          const n = i + 1;
          const level = levelMetaByNumber(n);
          let cls = 'level-node';
          if (n <= cleared) cls += ' cleared';
          else if (n === cleared + 1) cls += ' current';
          else cls += ' locked';
          const clickable = level != null && n === cleared + 1;
          return (
            <div
              key={n}
              className={cls}
              title={level ? level.title : `Level ${n} (coming soon)`}
              onClick={() => clickable && navigate(`/play/${n}`)}
            >
              {n}
            </div>
          );
        })}
      </div>

      <div style={{ color: 'var(--text-dim)', maxWidth: 480 }}>
        Total run score: <strong style={{ color: 'var(--accent)' }}>{run.totalScore}</strong>
        {run.completedAt && <> · Completed.</>}
      </div>

      <div className="row">
        <button onClick={() => navigate('/')}>Home</button>
        {cleared >= MAX_LEVEL && !run.completedAt && (
          <button className="primary" onClick={finishRun}>Submit run</button>
        )}
        <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
      </div>
    </div>
  );
}
