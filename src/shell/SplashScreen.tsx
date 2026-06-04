import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import {
  getCurrentSession,
  getKnownPlayers,
  removeKnownPlayer,
  setActivePlayer,
  type KnownPlayer,
  type PlayerSession,
} from '../services/session';
import { syncActiveRunFromServer } from '../services/progress';
import { IosInstallHint } from './IosInstallHint';
import { consumeReturnTo } from './postAuthReturn';

export function SplashScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const setPlayer = useGameStore((s) => s.setPlayer);
  const setRun = useGameStore((s) => s.setRun);
  const player = useGameStore((s) => s.player);

  const [roster, setRoster] = useState<KnownPlayer[]>([]);
  const [editing, setEditing] = useState(false);

  // When a navigator lands here with `state.pickPlayer === true` (e.g. the
  // "Switch player" button on LevelMap), stay on the splash so the chip
  // picker is visible. Otherwise, an active session auto-resumes into the game.
  const pickPlayer = (location.state as { pickPlayer?: boolean } | null)?.pickPlayer === true;

  useEffect(() => {
    void (async () => {
      const known = getKnownPlayers();
      setRoster(known);
      const session = getCurrentSession();
      if (session) {
        setPlayer(session);
        const run = await syncActiveRunFromServer(session.id);
        setRun(run ?? null);
        // Auto-resume only when there's a single known player on this device.
        // With multiple players, always show the picker so each kid actually
        // gets to choose (especially when joining a /versus/<code> lobby).
        // returnTo is peeked here and consumed by choosePlayer, so it survives
        // the picker step.
        const singlePlayer = known.length <= 1;
        if (!pickPlayer && singlePlayer) {
          const returnTo = consumeReturnTo();
          navigate(returnTo ?? (run ? '/journey' : '/clans'), { replace: true });
        }
      }
    })();
  }, [setPlayer, setRun, navigate, pickPlayer]);

  async function choosePlayer(p: KnownPlayer) {
    const session: PlayerSession = { id: p.id, nickname: p.nickname };
    setActivePlayer(session);
    setPlayer(session);
    const run = await syncActiveRunFromServer(p.id);
    setRun(run ?? null);
    const returnTo = consumeReturnTo();
    navigate(returnTo ?? (run ? '/journey' : '/clans'));
  }

  function forgetPlayer(p: KnownPlayer) {
    removeKnownPlayer(p.id);
    const remaining = getKnownPlayers();
    setRoster(remaining);
    if (player?.id === p.id) setPlayer(null);
    if (remaining.length === 0) setEditing(false);
  }

  function addPlayer() {
    navigate('/nickname');
  }

  return (
    <div className="screen">
      <img src="/logo.png" alt="Cactus Clans" className="logo" />
      <IosInstallHint />
      {roster.length === 0 ? (
        <>
          <h2>An adventure through the prickly wilds</h2>
          <div className="row">
            <button className="primary" onClick={addPlayer}>
              Start or resume
            </button>
            <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.5rem', maxWidth: '22rem', textAlign: 'center' }}>
            Played before on another device? Tap "Start or resume" and enter your existing nickname + PIN.
          </div>
        </>
      ) : (
        <>
          <h2>Who's playing?</h2>
          <div className="player-list">
            {roster.map((p) => (
              <div key={p.id} className="player-row">
                <button
                  className={`player-select${player?.id === p.id ? ' primary' : ''}`}
                  onClick={() => choosePlayer(p)}
                  disabled={editing}
                >
                  {p.nickname}
                </button>
                {editing && (
                  <button
                    className="player-remove"
                    aria-label={`Forget ${p.nickname}`}
                    onClick={() => forgetPlayer(p)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="row">
            <button onClick={addPlayer}>+ Add player</button>
            <button onClick={() => setEditing((e) => !e)}>{editing ? 'Done' : 'Edit'}</button>
            <button onClick={() => navigate('/leaderboard')}>Leaderboard</button>
          </div>
        </>
      )}
    </div>
  );
}
