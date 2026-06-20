import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchLeaderboard,
  fetchTeamLeaderboard,
  fetchPlayerRuns,
  type LeaderboardEntry,
  type TeamLeaderboardEntry,
  type PlayerRunSummary,
} from '../services/leaderboard';

const PAGE_SIZE = 25;
import { useGameStore } from '../store/gameStore';
import { usingRealBackend } from '../services/api';
import { MAX_LEVEL } from '../levels/meta';
import { useSeoMeta } from './useSeoMeta';
import { SharePanel } from './SharePanel';

const ALL_CLANS = 11;

type Tab = 'solo' | 'teams' | 'mine';

export function Leaderboard() {
  const [tab, setTab] = useState<Tab>('solo');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [soloTotal, setSoloTotal] = useState(0);
  const [teams, setTeams] = useState<TeamLeaderboardEntry[] | null>(null);
  const [teamsTotal, setTeamsTotal] = useState(0);
  const [myRuns, setMyRuns] = useState<PlayerRunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [soloPage, setSoloPage] = useState(0);
  const [teamsPage, setTeamsPage] = useState(0);
  const navigate = useNavigate();
  const player = useGameStore((s) => s.player);
  const run = useGameStore((s) => s.run);

  useSeoMeta({
    title: 'Leaderboard',
    description:
      'See the top Cactus Clans players and teams. Who has completed the most clans and scored the highest across all eight mini-games?',
    path: '/leaderboard',
  });

  useEffect(() => {
    setEntries(null);
    void (async () => {
      try {
        const page = await fetchLeaderboard(soloPage);
        setEntries(page.entries);
        setSoloTotal(page.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      }
    })();
  }, [soloPage]);

  // Load the team board when the Teams tab is opened, and re-fetch on page change.
  useEffect(() => {
    if (tab !== 'teams') return;
    setTeams(null);
    void (async () => {
      try {
        const page = await fetchTeamLeaderboard(teamsPage);
        setTeams(page.entries);
        setTeamsTotal(page.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load team leaderboard');
      }
    })();
  }, [tab, teamsPage]);

  // Load personal runs the first time the My Progress tab is opened.
  useEffect(() => {
    if (tab !== 'mine' || !player || myRuns != null) return;
    void (async () => {
      try {
        const rows = await fetchPlayerRuns(player.id);
        setMyRuns(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load your progress');
      }
    })();
  }, [tab, player, myRuns]);

  const completedCount = myRuns?.filter((r) => r.completedAt).length ?? 0;
  const allClansCompleted = completedCount >= ALL_CLANS;

  return (
    <div className="screen">
      <h1>Leaderboard</h1>
      {!usingRealBackend && (
        <h2 style={{ color: 'var(--accent-warm)' }}>Local-only (no backend configured)</h2>
      )}
      <div className="row" style={{ gap: 8 }}>
        <button
          onClick={() => { setTab('solo'); setSoloPage(0); }}
          aria-pressed={tab === 'solo'}
          style={{ opacity: tab === 'solo' ? 1 : 0.6 }}
        >
          Players
        </button>
        <button
          onClick={() => { setTab('teams'); setTeamsPage(0); }}
          aria-pressed={tab === 'teams'}
          style={{ opacity: tab === 'teams' ? 1 : 0.6 }}
        >
          Teams
        </button>
        {player && (
          <button
            onClick={() => setTab('mine')}
            aria-pressed={tab === 'mine'}
            style={{ opacity: tab === 'mine' ? 1 : 0.6 }}
          >
            My Progress
          </button>
        )}
      </div>
      {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
      {tab === 'solo' ? (
        entries == null ? (
          <div>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>No runs yet. Be the first!</div>
        ) : (() => {
          const totalPages = Math.ceil(soloTotal / PAGE_SIZE);
          return (
            <>
              <div className="leaderboard-list">
                {entries.map((e, i) => {
                  const rank = soloPage * PAGE_SIZE + i + 1;
                  return (
                    <div
                      key={`${e.nickname}-${rank}`}
                      className={`leaderboard-row${player?.nickname === e.nickname ? ' me' : ''}`}
                    >
                      <span className="rank">#{rank}</span>
                      <span>
                        <strong>{e.nickname}</strong>
                        {e.completedAt && (
                          <span title="Run completed" aria-label="Run completed" style={{ marginLeft: 6 }}>🏅</span>
                        )}
                        {e.allClansCompleted && (
                          <span title="Completed all clans" aria-label="Completed all clans" style={{ marginLeft: 4 }}>🏆</span>
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
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button onClick={() => setSoloPage(0)} disabled={soloPage === 0}>«</button>
                  <button onClick={() => setSoloPage((p) => p - 1)} disabled={soloPage === 0}>‹ Prev</button>
                  <span style={{ alignSelf: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {soloPage + 1} / {totalPages}
                  </span>
                  <button onClick={() => setSoloPage((p) => p + 1)} disabled={soloPage >= totalPages - 1}>Next ›</button>
                  <button onClick={() => setSoloPage(totalPages - 1)} disabled={soloPage >= totalPages - 1}>»</button>
                </div>
              )}
            </>
          );
        })()
      ) : tab === 'teams' ? (
        teams == null ? (
          <div>Loading…</div>
        ) : teams.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>
            No teams yet. Bop a balloon together in versus mode to set a high score!
          </div>
        ) : (() => {
          const totalPages = Math.ceil(teamsTotal / PAGE_SIZE);
          return (
            <>
              <div className="leaderboard-list">
                {teams.map((t, i) => {
                  const rank = teamsPage * PAGE_SIZE + i + 1;
                  return (
                    <div
                      key={`${t.teamLabel}-${rank}`}
                      className={`leaderboard-row${
                        player && t.teamLabel.split(' & ').includes(player.nickname) ? ' me' : ''
                      }`}
                    >
                      <span className="rank">#{rank}</span>
                      <span>
                        <span title="Team" aria-hidden style={{ marginRight: 6 }}>🎈</span>
                        <strong>{t.teamLabel}</strong>
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{t.score}</span>
                    </div>
                  );
                })}
              </div>
              {totalPages > 1 && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button onClick={() => setTeamsPage(0)} disabled={teamsPage === 0}>«</button>
                  <button onClick={() => setTeamsPage((p) => p - 1)} disabled={teamsPage === 0}>‹ Prev</button>
                  <span style={{ alignSelf: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                    {teamsPage + 1} / {totalPages}
                  </span>
                  <button onClick={() => setTeamsPage((p) => p + 1)} disabled={teamsPage >= totalPages - 1}>Next ›</button>
                  <button onClick={() => setTeamsPage(totalPages - 1)} disabled={teamsPage >= totalPages - 1}>»</button>
                </div>
              )}
            </>
          );
        })()
      ) : (
        // My Progress tab
        myRuns == null ? (
          <div>Loading…</div>
        ) : (
          <div style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              {allClansCompleted ? (
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                  🏆 Grand Champion — all {ALL_CLANS} clans complete!
                </div>
              ) : (
                <div style={{ color: 'var(--text-dim)' }}>
                  {completedCount} of {ALL_CLANS} clans complete
                </div>
              )}
            </div>
            {myRuns.length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center' }}>
                Start playing to track your progress here!
              </div>
            ) : (
              <div className="leaderboard-list">
                {myRuns.map((r, i) => (
                  <div key={`${r.clan}-${i}`} className="leaderboard-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      <strong>{r.clan}</strong>
                      {r.completedAt && (
                        <span title="Completed" style={{ marginLeft: 6 }}>✓</span>
                      )}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      {r.completedAt
                        ? 'Completed'
                        : `Level ${r.currentLevel} / ${MAX_LEVEL}`}
                    </span>
                    <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{r.totalScore}</span>
                  </div>
                ))}
              </div>
            )}
            {completedCount > 0 && (
              <div style={{ marginTop: 12, textAlign: 'right', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                Total across completed clans:{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  {myRuns.filter((r) => r.completedAt).reduce((sum, r) => sum + r.totalScore, 0)}
                </strong>
              </div>
            )}
          </div>
        )
      )}
      <SharePanel
        text={
          run
            ? `I scored ${run.totalScore} pts with the ${run.clan} on Cactus Clans! 🌵 Can you beat me?`
            : `Can you beat Cactus Clans? 🌵 Free clan card game!`
        }
      />
      <div className="row">
        <button onClick={() => navigate('/game')}>Play</button>
      </div>
    </div>
  );
}
