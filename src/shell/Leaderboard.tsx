import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLeaderboard, type LeaderboardEntry } from '../services/leaderboard';
import { useGameStore } from '../store/gameStore';
import { usingRealBackend } from '../services/api';

export function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await fetchLeaderboard();
        setEntries(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    })();
  }, []);

  return (
    <div className="screen">
      <h1>Leaderboard</h1>
      {!usingRealBackend && (
        <h2 style={{ color: 'var(--accent-warm)' }}>Local-only (no backend configured)</h2>
      )}
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {entries == null ? (
        <div>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ color: 'var(--text-dim)' }}>No runs yet. Be the first!</div>
      ) : (
        <div className="leaderboard-list">
          {entries.map((e, i) => (
            <div
              key={`${e.nickname}-${i}`}
              className={`leaderboard-row${player?.nickname === e.nickname ? ' me' : ''}`}
            >
              <span className="rank">#{i + 1}</span>
              <span>
                <strong>{e.nickname}</strong>
                {e.completedAt && (
                  <span title="Run completed" aria-label="Run completed" style={{ marginLeft: 6 }}>🏅</span>
                )}
                <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontSize: '0.85rem' }}>{e.clan}</span>
                {!e.completedAt && (
                  <span style={{ color: 'var(--accent-warm)', marginLeft: 8, fontSize: '0.75rem' }}>· in progress</span>
                )}
              </span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.totalScore}</span>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <button onClick={() => navigate('/')}>Home</button>
      </div>
    </div>
  );
}
