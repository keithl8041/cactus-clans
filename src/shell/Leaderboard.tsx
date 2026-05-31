import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchLeaderboard,
  fetchTeamLeaderboard,
  type LeaderboardEntry,
  type TeamLeaderboardEntry,
} from '../services/leaderboard';
import { useGameStore } from '../store/gameStore';
import { usingRealBackend } from '../services/api';

type Tab = 'solo' | 'teams';

export function Leaderboard() {
  const [tab, setTab] = useState<Tab>('solo');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [teams, setTeams] = useState<TeamLeaderboardEntry[] | null>(null);
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

  // Lazy-load the team board the first time the Teams tab is opened.
  useEffect(() => {
    if (tab !== 'teams' || teams != null) return;
    void (async () => {
      try {
        const rows = await fetchTeamLeaderboard();
        setTeams(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team leaderboard');
      }
    })();
  }, [tab, teams]);

  return (
    <div className="screen">
      <h1>Leaderboard</h1>
      {!usingRealBackend && (
        <h2 style={{ color: 'var(--accent-warm)' }}>Local-only (no backend configured)</h2>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button
          onClick={() => setTab('solo')}
          aria-pressed={tab === 'solo'}
          style={{ opacity: tab === 'solo' ? 1 : 0.6 }}
        >
          Players
        </button>
        <button
          onClick={() => setTab('teams')}
          aria-pressed={tab === 'teams'}
          style={{ opacity: tab === 'teams' ? 1 : 0.6 }}
        >
          Teams
        </button>
      </div>
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {tab === 'solo' ? (
        entries == null ? (
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
                    <span style={{ color: 'var(--accent-warm)', marginLeft: 8, fontSize: '0.75rem' }}>
                      {e.currentLevel ? `· on level ${e.currentLevel}` : '· in progress'}
                    </span>
                  )}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{e.totalScore}</span>
              </div>
            ))}
          </div>
        )
      ) : teams == null ? (
        <div>Loading…</div>
      ) : teams.length === 0 ? (
        <div style={{ color: 'var(--text-dim)' }}>
          No teams yet. Bop a balloon together in versus mode to set a high score!
        </div>
      ) : (
        <div className="leaderboard-list">
          {teams.map((t, i) => (
            <div
              key={`${t.teamLabel}-${i}`}
              className={`leaderboard-row${
                player && t.teamLabel.split(' & ').includes(player.nickname) ? ' me' : ''
              }`}
            >
              <span className="rank">#{i + 1}</span>
              <span>
                <span title="Team" aria-hidden style={{ marginRight: 6 }}>🎈</span>
                <strong>{t.teamLabel}</strong>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{t.score}</span>
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
