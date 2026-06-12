import { useEffect, useState } from 'react';
import { fetchDemoLeaderboard, type DemoLeaderboardEntry } from '../services/leaderboard';

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Standalone display leaderboard at `/demo-board`.
 * Designed to be left on a laptop screen during the fair — no controls,
 * auto-refreshes every 60 seconds.
 */
export function DemoBoard() {
  const [entries, setEntries] = useState<DemoLeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL_MS / 1000);

  async function load() {
    try {
      const rows = await fetchDemoLeaderboard(20);
      setEntries(rows);
      setLastUpdated(new Date());
      setSecondsUntilRefresh(REFRESH_INTERVAL_MS / 1000);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    }
  }

  // Initial load + periodic refresh
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Countdown tick
  useEffect(() => {
    const tick = setInterval(() => {
      setSecondsUntilRefresh((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '2.5rem 1.5rem 2rem',
        gap: '1rem',
      }}
    >
      <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', margin: 0 }}>
        🌵 JKPS Summer Fair
      </h1>
      <h2 style={{ fontSize: 'clamp(1.2rem, 3vw, 2rem)', margin: 0, fontWeight: 'normal', opacity: 0.85 }}>
        Cactus Dart Toss · Top Scores
      </h2>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>{error}</div>
      )}

      {entries == null ? (
        <div style={{ fontSize: '1.5rem', opacity: 0.6, marginTop: '3rem' }}>Loading…</div>
      ) : entries.length === 0 ? (
        <div style={{ fontSize: '1.5rem', opacity: 0.6, marginTop: '3rem' }}>
          No scores yet — be the first!
        </div>
      ) : (
        <div
          className="leaderboard-list"
          style={{ maxWidth: '600px', width: '100%', gap: '0.75rem' }}
        >
          {entries.map((e, i) => (
            <div
              key={e.nickname}
              className="leaderboard-row"
              style={{
                padding: 'clamp(0.75rem, 2vw, 1.25rem) clamp(1rem, 3vw, 1.75rem)',
                fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)',
              }}
            >
              <span className="rank" style={{ fontSize: 'inherit' }}>
                {i < 3 ? medals[i] : `#${i + 1}`}
              </span>
              <span>
                <strong>{e.nickname}</strong>
              </span>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                {e.score}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 'auto',
          paddingTop: '1.5rem',
          fontSize: '0.9rem',
          opacity: 0.5,
          display: 'flex',
          gap: '1.5rem',
        }}
      >
        {lastUpdated && (
          <span>
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span>Refreshing in {secondsUntilRefresh}s</span>
      </div>
    </div>
  );
}
